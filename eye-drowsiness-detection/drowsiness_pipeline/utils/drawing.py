"""Optional OpenCV debug overlay."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray

from drowsiness_pipeline.core.landmarks import EyeLandmarks
from drowsiness_pipeline.logic.thresholding import DrowsinessStatus


def draw_status(
    frame: NDArray[np.uint8],
    status: DrowsinessStatus,
    *,
    fps: float,
    eyes: EyeLandmarks | None = None,
) -> NDArray[np.uint8]:
    """Draw eye contours, EAR/state, and measured FPS in-place."""
    try:
        import cv2
    except ImportError as exc:  # pragma: no cover - depends on runtime setup
        raise RuntimeError("OpenCV is required for debug drawing") from exc

    if eyes is not None:
        for eye in (eyes.left, eyes.right):
            contour = np.rint(eye).astype(np.int32).reshape((-1, 1, 2))
            cv2.polylines(frame, [contour], True, (0, 255, 0), 1, cv2.LINE_AA)

    if status.face_detected:
        state = "DROWSY" if status.alert_active else "AWAKE"
        ear_text = f"EAR: {status.ear:.3f}  Closed: {status.closed_frames}"
        color = (0, 0, 255) if status.alert_active else (0, 200, 0)
    else:
        state = "NO FACE"
        ear_text = "EAR: --"
        color = (0, 180, 255)

    cv2.putText(frame, state, (16, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
    cv2.putText(frame, ear_text, (16, 64), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)
    cv2.putText(
        frame,
        f"FPS: {fps:.1f}",
        (16, 88),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (255, 255, 255),
        1,
    )
    return frame

