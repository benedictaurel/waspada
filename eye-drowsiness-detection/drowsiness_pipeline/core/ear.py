"""Eye Aspect Ratio (EAR) mathematics."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np
from numpy.typing import ArrayLike


def calculate_ear(eye_points: ArrayLike) -> float:
    """Calculate EAR from six 2-D points ordered p1 through p6.

    The formula is ``(||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)``.
    Pixel coordinates should be used instead of normalized coordinates so that
    non-square frames do not distort vertical and horizontal distances.
    """
    points = np.asarray(eye_points, dtype=np.float64)
    if points.shape != (6, 2):
        raise ValueError(f"eye_points must have shape (6, 2), got {points.shape}")
    if not np.all(np.isfinite(points)):
        raise ValueError("eye_points must contain only finite values")

    vertical_outer = np.linalg.norm(points[1] - points[5])
    vertical_inner = np.linalg.norm(points[2] - points[4])
    horizontal = np.linalg.norm(points[0] - points[3])
    if horizontal <= np.finfo(np.float64).eps:
        raise ValueError("Eye corner points p1 and p4 must not overlap")

    return float((vertical_outer + vertical_inner) / (2.0 * horizontal))


def average_ear(left_eye: ArrayLike, right_eye: ArrayLike) -> float:
    """Return the mean EAR for both eyes."""
    ears: Sequence[float] = (calculate_ear(left_eye), calculate_ear(right_eye))
    return float(np.mean(ears))

