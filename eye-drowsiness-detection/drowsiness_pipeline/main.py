"""Command-line entry point for real-time drowsiness detection."""

from __future__ import annotations

import argparse
import math
import time
from collections import deque
from collections.abc import Sequence

from drowsiness_pipeline.utils.wheel_vibration import vibrate_sine
from drowsiness_pipeline.utils.mqtt_publisher import MqttPublisher
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
    parser.add_argument("--mqtt", action="store_true", help="publish status to the dashboard")
    parser.add_argument("--mqtt-host", default="broker.hivemq.com")
    parser.add_argument("--mqtt-port", type=int, default=8883, help="MQTT TLS port")
    parser.add_argument("--mqtt-latitude", type=float, help="device latitude")
    parser.add_argument("--mqtt-longitude", type=float, help="device longitude")
    parser.add_argument("--mqtt-interval", type=float, default=5.0, help="seconds between status messages")
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
    if args.mqtt:
        if args.mqtt_latitude is None or not math.isfinite(args.mqtt_latitude) or not -90 <= args.mqtt_latitude <= 90:
            parser.error("--mqtt-latitude must be between -90 and 90")
        if args.mqtt_longitude is None or not math.isfinite(args.mqtt_longitude) or not -180 <= args.mqtt_longitude <= 180:
            parser.error("--mqtt-longitude must be between -180 and 180")
        if not 1 <= args.mqtt_port <= 65535:
            parser.error("--mqtt-port must be between 1 and 65535")
        if not math.isfinite(args.mqtt_interval) or args.mqtt_interval <= 0:
            parser.error("--mqtt-interval must be greater than zero")


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
    publisher = None
    last_publish_time = 0.0
    last_published_status = None

    try:
        if args.mqtt:
            publisher = MqttPublisher(
                latitude=args.mqtt_latitude,
                longitude=args.mqtt_longitude,
                host=args.mqtt_host,
                port=args.mqtt_port,
            )
            print(f"[MQTT] Publishing as {publisher.raspi_id} to {publisher.topic}", flush=True)
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

                        try:
                            vibrate_sine(2.0)
                        except Exception as exc:
                            print(
                                f"[Wheel vibration error] {exc}",
                                flush=True,
                            )
                    if publisher is not None:
                        publish_now = time.perf_counter()
                        if (
                            status.alert_active != last_published_status
                            or publish_now - last_publish_time >= args.mqtt_interval
                        ):
                            try:
                                publisher.publish(status.alert_active)
                                last_publish_time = publish_now
                                last_published_status = status.alert_active
                            except Exception as exc:
                                print(f"[MQTT publish error] {exc}", flush=True)
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
        if publisher is not None:
            publisher.close()
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
