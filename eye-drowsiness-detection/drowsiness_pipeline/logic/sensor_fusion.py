"""Parse ESP32 UART frames and combine the prototype sensor channels."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SensorFrame:
    sequence: int
    left_mv: int
    right_mv: int
    left_state: int  # 0 released, 1 held, 2 weak
    right_state: int
    ecg_state: int  # 0 absent, 1 normal, 2 weak; demo proxy, not an ECG reading


def parse_sensor_frame(line: bytes) -> SensorFrame | None:
    try:
        fields = line.decode("ascii").strip().split(",")
        if len(fields) != 7 or fields[0] != "F":
            return None
        sequence, left_mv, right_mv, left_state, right_state, ecg_state = map(int, fields[1:])
    except (UnicodeDecodeError, ValueError):
        return None
    if (sequence < 0 or not 0 <= left_mv <= 3300 or not 0 <= right_mv <= 3300
            or left_state not in (0, 1, 2) or right_state not in (0, 1, 2)
            or ecg_state not in (0, 1, 2)):
        return None
    return SensorFrame(sequence, left_mv, right_mv, left_state, right_state, ecg_state)


class UartSensorReader:
    def __init__(self, port: str, baud: int = 115200) -> None:
        import serial

        self._serial = serial.Serial(port, baudrate=baud, timeout=0)
        self._buffer = bytearray()
        self.latest: SensorFrame | None = None
        self.last_received_at = 0.0

    def poll(self, now: float) -> None:
        chunk = self._serial.read(min(self._serial.in_waiting or 1, 4096))
        if not chunk:
            return
        self._buffer.extend(chunk)
        if len(self._buffer) > 4096:
            self._buffer.clear()
            return
        while b"\n" in self._buffer:
            line, _, remainder = self._buffer.partition(b"\n")
            self._buffer = bytearray(remainder)
            frame = parse_sensor_frame(line)
            if frame is not None:
                self.latest = frame
                self.last_received_at = now

    def close(self) -> None:
        self._serial.close()


@dataclass(frozen=True)
class FusionResult:
    score: float
    drowsy: bool
    ear_flag: bool
    fsr_flag: bool
    ecg_flag: bool


def calculate_fusion(ear_alert: bool, frame: SensorFrame) -> FusionResult:
    fsr_flag = frame.left_state != 1 or frame.right_state != 1
    ecg_flag = frame.ecg_state != 1
    score = 0.50 * int(ear_alert) + 0.30 * int(ecg_flag) + 0.20 * int(fsr_flag)
    return FusionResult(score, score > 0.75, ear_alert, fsr_flag, ecg_flag)
