"""Preprocessing suited to visible-light and IR camera frames."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray


class FramePreprocessor:
    """Normalize a BGR/IR frame to the RGB input expected by MediaPipe."""

    def __init__(self, use_clahe: bool = False, clip_limit: float = 2.0) -> None:
        try:
            import cv2
        except ImportError as exc:  # pragma: no cover - depends on runtime setup
            raise RuntimeError(
                "OpenCV is not installed. Run: pip install -r requirements.txt"
            ) from exc

        self._cv2: Any = cv2
        self._clahe = (
            cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
            if use_clahe
            else None
        )

    def process(self, frame: NDArray[np.uint8]) -> NDArray[np.uint8]:
        """Convert BGR or grayscale input into three-channel RGB."""
        if frame.ndim == 2:
            gray = frame
        elif frame.ndim == 3 and frame.shape[2] == 3:
            gray = self._cv2.cvtColor(frame, self._cv2.COLOR_BGR2GRAY)
        else:
            raise ValueError("frame must be grayscale or a three-channel BGR image")

        if self._clahe is not None:
            gray = self._clahe.apply(gray)
        return self._cv2.cvtColor(gray, self._cv2.COLOR_GRAY2RGB)

