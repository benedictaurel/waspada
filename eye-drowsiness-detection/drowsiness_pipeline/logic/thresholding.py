"""Consecutive-frame state machine for drowsiness alerts."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DrowsinessStatus:
    ear: float | None
    face_detected: bool
    closed_frames: int
    alert_active: bool
    alert_started: bool


class DrowsinessMonitor:
    """Trigger after EAR remains below a threshold for enough frames."""

    def __init__(self, ear_threshold: float = 0.22, consecutive_frames: int = 18) -> None:
        if not 0.0 < ear_threshold < 1.0:
            raise ValueError("ear_threshold must be between 0 and 1")
        if consecutive_frames < 1:
            raise ValueError("consecutive_frames must be at least 1")

        self.ear_threshold = ear_threshold
        self.consecutive_frames = consecutive_frames
        self._closed_frames = 0
        self._alert_active = False

    def update(self, ear: float | None) -> DrowsinessStatus:
        """Advance the state machine.

        A missing face resets the sequence. This prevents non-contiguous closed-eye
        detections from accumulating across tracking loss.
        """
        if ear is None:
            self.reset()
            return DrowsinessStatus(None, False, 0, False, False)
        if not 0.0 <= ear < float("inf"):
            raise ValueError("ear must be a finite non-negative value")

        previous_alert = self._alert_active
        if ear < self.ear_threshold:
            self._closed_frames += 1
        else:
            self._closed_frames = 0

        self._alert_active = self._closed_frames >= self.consecutive_frames
        return DrowsinessStatus(
            ear=ear,
            face_detected=True,
            closed_frames=self._closed_frames,
            alert_active=self._alert_active,
            alert_started=self._alert_active and not previous_alert,
        )

    def reset(self) -> None:
        self._closed_frames = 0
        self._alert_active = False

