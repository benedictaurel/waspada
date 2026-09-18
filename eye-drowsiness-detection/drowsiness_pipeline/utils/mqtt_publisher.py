"""Publish detector status under the Raspberry Pi's hardware serial number."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def read_raspi_serial() -> str:
    """Read the Pi serial used as RaspiUniqueID in the dashboard."""
    cpuinfo = Path("/proc/cpuinfo")
    if cpuinfo.exists():
        for line in cpuinfo.read_text(encoding="utf-8").splitlines():
            if line.lower().startswith("serial") and ":" in line:
                serial = line.split(":", 1)[1].strip()
                if serial and all(char in "0123456789abcdefABCDEF" for char in serial):
                    return serial
    device_tree = Path("/proc/device-tree/serial-number")
    if device_tree.exists():
        serial = device_tree.read_text(encoding="utf-8").strip("\x00\n ")
        if serial and all(char in "0123456789abcdefABCDEF" for char in serial):
            return serial
    raise RuntimeError("Raspberry Pi serial not found in /proc/cpuinfo or device tree")


class MqttPublisher:
    def __init__(
        self,
        latitude: float,
        longitude: float,
        host: str = "broker.hivemq.com",
        port: int = 8883,
        raspi_id: str | None = None,
    ) -> None:
        import paho.mqtt.client as mqtt

        self.latitude = latitude
        self.longitude = longitude
        self.raspi_id = raspi_id or read_raspi_serial()
        if not self.raspi_id or not all(c.isalnum() or c in "_-" for c in self.raspi_id):
            raise ValueError("Raspberry Pi ID contains unsupported characters")
        self.topic = f"/waspada/logs/{self.raspi_id}"
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._client.tls_set()
        self._client.connect(host, port, keepalive=60)
        self._client.loop_start()

    def publish(self, drowsy: bool) -> None:
        payload = json.dumps({
            "latitude": self.latitude,
            "longitude": self.longitude,
            "drowsy": drowsy,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        result = self._client.publish(self.topic, payload, qos=1, retain=False)
        if result.rc != 0:
            raise RuntimeError(f"MQTT publish failed with code {result.rc}")

    def close(self) -> None:
        self._client.loop_stop()
        self._client.disconnect()
