"""Camera acquisition with Raspberry Pi Picamera2 support."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CameraConfig:
    index: int = 0
    width: int = 1280
    height: int = 720
    fps: int = 30


class WebcamCapture:
    """Camera wrapper supporting Raspberry Pi CSI camera."""

    def __init__(self, config: CameraConfig | None = None) -> None:
        self.config = config or CameraConfig()
        self._capture: Any | None = None

    def open(self) -> "WebcamCapture":
        if self._capture is not None:
            return self

        try:
            from picamera2 import Picamera2

            picam2 = Picamera2()

            camera_config = picam2.create_video_configuration(
                main={
                    "size": (self.config.width, self.config.height),
                    "format": "RGB888",
                },
                controls={
                    "FrameRate": self.config.fps,
                },
            )

            picam2.configure(camera_config)
            picam2.start()

            self._capture = picam2

            print(
                f"[Camera] Picamera2 "
                f"{self.config.width}x{self.config.height}@{self.config.fps}"
            )

            return self

        except Exception as exc:
            raise RuntimeError(
                f"Failed to open Raspberry Pi camera: {exc}"
            ) from exc

    def read(self) -> Any:
        if self._capture is None:
            raise RuntimeError("Camera is not open")

        import cv2

        frame = self._capture.capture_array()

        if frame is None:
            raise RuntimeError("Failed to capture frame")

        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

        return frame

    def close(self) -> None:
        if self._capture is not None:
            self._capture.stop()
            self._capture.close()
            self._capture = None

    def __enter__(self) -> "WebcamCapture":
        return self.open()

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.close()
