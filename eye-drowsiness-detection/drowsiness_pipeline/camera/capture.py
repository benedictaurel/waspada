"""OpenCV-backed camera acquisition."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CameraConfig:
    """Settings applied when opening a webcam."""

    index: int = 0
    width: int = 1280
    height: int = 720
    fps: int = 30


class WebcamCapture:
    """Small context-managed wrapper around ``cv2.VideoCapture``."""

    def __init__(self, config: CameraConfig | None = None) -> None:
        self.config = config or CameraConfig()
        self._capture: Any | None = None

    def open(self) -> "WebcamCapture":
        if self._capture is not None:
            return self

        try:
            import cv2
        except ImportError as exc:  # pragma: no cover - depends on runtime setup
            raise RuntimeError(
                "OpenCV is not installed. Run: pip install -r requirements.txt"
            ) from exc

        capture = cv2.VideoCapture(self.config.index)
        if not capture.isOpened():
            capture.release()
            raise RuntimeError(f"Could not open camera index {self.config.index}")

        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        capture.set(cv2.CAP_PROP_FPS, self.config.fps)
        self._capture = capture
        return self

    def read(self) -> Any:
        """Return the next BGR frame or raise if acquisition fails."""
        if self._capture is None:
            raise RuntimeError("Camera is not open")

        ok, frame = self._capture.read()
        if not ok or frame is None:
            raise RuntimeError("Failed to read a frame from the camera")
        return frame

    def close(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None

    def __enter__(self) -> "WebcamCapture":
        return self.open()

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.close()

