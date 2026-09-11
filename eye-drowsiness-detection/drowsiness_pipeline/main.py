"""Command-line entry point for real-time drowsiness detection."""

from __future__ import annotations

import argparse
import time
from collections import deque
from collections.abc import Sequence

from drowsiness_pipeline.camera import CameraConfig, WebcamCapture
from drowsiness_pipeline.core import FaceLandmarkDetector, average_ear
from drowsiness_pipeline.logic import DrowsinessMonitor, DrowsinessStatus
from drowsiness_pipeline.utils import FramePreprocessor, draw_status


class FpsTracker:
    """Rolling-average FPS estimator."""

    def __init__(self, window: int = 30) -> None:
        self._timestamps: deque[float] = deque(maxlen=window)

    def tick(self) -> float:
        now = time.perf_counter()
        self._timestamps.append(now)
        if len(self._timestamps) < 2:
            return 0.0
        elapsed = self._timestamps[-1] - self._timestamps[0]
        return (len(self._timestamps) - 1) / elapsed if elapsed > 0 else 0.0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Real-time driver drowsiness detection")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--fps", type=int, default=30, help="requested capture FPS")
    parser.add_argument(
        "--model-path",
        default=None,
        help="optional path to a MediaPipe Face Landmarker .task model",
    )
    parser.add_argument("--ear-threshold", type=float, default=0.22)
    parser.add_argument("--consecutive-frames", type=int, default=18)
    parser.add_argument(
        "--process-every",
        type=int,
        default=1,
        help="run inference every Nth captured frame (default: 1)",
    )
    parser.add_argument("--clahe", action="store_true", help="enhance low-light/IR contrast")
    parser.add_argument(
        "--no-display",
        action="store_true",
        help="run without an OpenCV window; stop with Ctrl+C",
    )
    parser.add_argument(
        "--log-interval",
        type=float,
        default=5.0,
        help="seconds between performance logs in headless mode (default: 5)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=None,
        help=argparse.SUPPRESS,
    )
    return parser


def _validate_args(parser: argparse.ArgumentParser, args: argparse.Namespace) -> None:
    for name in ("width", "height", "fps", "consecutive_frames", "process_every"):
        if getattr(args, name) < 1:
            parser.error(f"--{name.replace('_', '-')} must be at least 1")
    if not 0.0 < args.ear_threshold < 1.0:
        parser.error("--ear-threshold must be between 0 and 1")
    if args.log_interval <= 0.0:
        parser.error("--log-interval must be greater than 0")
    if args.max_frames is not None and args.max_frames < 1:
        parser.error("--max-frames must be at least 1")


def _sound_alert() -> None:
    """Emit a dependency-free alert (terminal bell; Windows beep when available)."""
    try:
        import winsound

        winsound.Beep(1800, 350)
    except (ImportError, RuntimeError):  # pragma: no cover - platform-specific
        print("\a", end="", flush=True)


def run(args: argparse.Namespace) -> int:
    import cv2

    target_frame_time = 1.0 / args.fps
    next_frame_time = time.perf_counter()

    camera_config = CameraConfig(args.camera_index, args.width, args.height, args.fps)
    monitor = DrowsinessMonitor(args.ear_threshold, args.consecutive_frames)
    preprocessor = FramePreprocessor(use_clahe=args.clahe)
    fps_tracker = FpsTracker()
    status = DrowsinessStatus(None, False, 0, False, False)
    eyes = None
    frames_seen = 0
    last_log_time = time.perf_counter()

    try:
        with WebcamCapture(camera_config) as camera, FaceLandmarkDetector(
            model_path=args.model_path
        ) as detector:
            while args.max_frames is None or frames_seen < args.max_frames:
                now = time.perf_counter()

                if now < next_frame_time:
                    time.sleep(next_frame_time - now)

                next_frame_time = max(
                    next_frame_time + target_frame_time,
                    time.perf_counter()
                )
    
                frame = camera.read()
                frames_seen += 1

                if (frames_seen - 1) % args.process_every == 0:
                    rgb_frame = preprocessor.process(frame)
                    eyes = detector.detect(rgb_frame)
                    if eyes is None:
                        status = monitor.update(None)
                    else:
                        status = monitor.update(average_ear(eyes.left, eyes.right))

                    if status.alert_started:
                        print(
                            f"ALERT: eyes closed for {status.closed_frames} processed frames "
                            f"(EAR={status.ear:.3f})",
                            flush=True,
                        )
                        _sound_alert()
                else:
                    # Eye contours belong to the last processed frame and should
                    # not be drawn at stale coordinates on a newer frame.
                    eyes = None

                measured_fps = fps_tracker.tick()
                if not args.no_display:
                    draw_status(frame, status, fps=measured_fps, eyes=eyes)
                    cv2.imshow("Driver Drowsiness Detection", frame)
                    if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                        break
                elif time.perf_counter() - last_log_time >= args.log_interval:
                    ear_text = "--" if status.ear is None else f"{status.ear:.3f}"
                    print(
                        f"FPS={measured_fps:.1f} EAR={ear_text} "
                        f"closed={status.closed_frames} alert={status.alert_active}",
                        flush=True,
                    )
                    last_log_time = time.perf_counter()
    except KeyboardInterrupt:
        pass
    finally:
        if not args.no_display:
            cv2.destroyAllWindows()

    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    _validate_args(parser, args)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
