"""MediaPipe face-landmark detection and eye point extraction."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time
from typing import Any

import numpy as np
from numpy.typing import NDArray


LEFT_EYE_INDICES: tuple[int, ...] = (33, 160, 158, 133, 153, 144)
RIGHT_EYE_INDICES: tuple[int, ...] = (362, 385, 387, 263, 373, 380)
DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parent.parent / "models" / "face_landmarker.task"
)


@dataclass(frozen=True)
class EyeLandmarks:
    """Six pixel-coordinate points for each eye."""

    left: NDArray[np.float64]
    right: NDArray[np.float64]


class FaceLandmarkDetector:
    """Lightweight single-face detector backed by MediaPipe Tasks."""

    def __init__(
        self,
        *,
        model_path: str | Path | None = None,
        min_detection_confidence: float = 0.5,
        min_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        try:
            import mediapipe as mp
        except ImportError as exc:  # pragma: no cover - depends on runtime setup
            raise RuntimeError(
                "MediaPipe is not installed. Run: pip install -r requirements.txt"
            ) from exc

        resolved_model_path = Path(model_path or DEFAULT_MODEL_PATH).resolve()
        if not resolved_model_path.is_file():
            raise RuntimeError(
                f"Face Landmarker model not found: {resolved_model_path}. "
                "Restore drowsiness_pipeline/models/face_landmarker.task or "
                "provide --model-path."
            )

        try:
            options = mp.tasks.vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(
                    model_asset_path=str(resolved_model_path)
                ),
                running_mode=mp.tasks.vision.RunningMode.VIDEO,
                num_faces=1,
                min_face_detection_confidence=min_detection_confidence,
                min_face_presence_confidence=min_presence_confidence,
                min_tracking_confidence=min_tracking_confidence,
                output_face_blendshapes=False,
                output_facial_transformation_matrixes=False,
            )
            self._landmarker: Any = (
                mp.tasks.vision.FaceLandmarker.create_from_options(options)
            )
        except AttributeError as exc:  # pragma: no cover - version-specific
            raise RuntimeError(
                "This project requires the MediaPipe Tasks Face Landmarker API. "
                "Reinstall the versions in requirements.txt."
            ) from exc

        self._mp: Any = mp
        self._last_timestamp_ms = -1

    def detect(self, rgb_frame: NDArray[np.uint8]) -> EyeLandmarks | None:
        """Extract eye landmarks from an RGB frame, or return ``None``."""
        if rgb_frame.ndim != 3 or rgb_frame.shape[2] != 3:
            raise ValueError("rgb_frame must have shape (height, width, 3)")

        timestamp_ms = time.monotonic_ns() // 1_000_000
        if timestamp_ms <= self._last_timestamp_ms:
            timestamp_ms = self._last_timestamp_ms + 1
        self._last_timestamp_ms = timestamp_ms

        media_image = self._mp.Image(
            image_format=self._mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(rgb_frame),
        )
        result = self._landmarker.detect_for_video(media_image, timestamp_ms)

        if not result.face_landmarks:
            return None

        height, width = rgb_frame.shape[:2]
        landmarks = result.face_landmarks[0]

        def points_for(indices: tuple[int, ...]) -> NDArray[np.float64]:
            return np.asarray(
                [
                    (landmarks[index].x * width, landmarks[index].y * height)
                    for index in indices
                ],
                dtype=np.float64,
            )

        return EyeLandmarks(
            left=points_for(LEFT_EYE_INDICES),
            right=points_for(RIGHT_EYE_INDICES),
        )

    def close(self) -> None:
        self._landmarker.close()

    def __enter__(self) -> "FaceLandmarkDetector":
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.close()
