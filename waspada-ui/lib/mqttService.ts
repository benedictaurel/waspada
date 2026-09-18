import mqtt, { type MqttClient } from "mqtt";
import type { DriverLog } from "./types";

export type MqttConnectionState = "connecting" | "connected" | "disconnected";
export const LOG_TOPIC = "/waspada/logs/+";

export function parseDriverLog(topic: string, payload: string): DriverLog | null {
  const match = /^\/waspada\/logs\/([^/]+)$/.exec(topic);
  if (!match) return null;
  try {
    const data: unknown = JSON.parse(payload);
    if (typeof data !== "object" || data === null) return null;
    const log = data as Record<string, unknown>;
    if (
      typeof log.latitude !== "number" || !Number.isFinite(log.latitude) ||
      log.latitude < -90 || log.latitude > 90 ||
      typeof log.longitude !== "number" || !Number.isFinite(log.longitude) ||
      log.longitude < -180 || log.longitude > 180 ||
      typeof log.drowsy !== "boolean" ||
      typeof log.timestamp !== "string" || !Number.isFinite(Date.parse(log.timestamp))
    ) return null;
    return {
      raspiUniqueId: match[1],
      latitude: log.latitude,
      longitude: log.longitude,
      drowsy: log.drowsy,
      timestamp: log.timestamp,
      receivedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function subscribeToDriverLogs(
  onLog: (log: DriverLog) => void,
  onState: (state: MqttConnectionState, error?: string) => void,
): () => void {
  const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "wss://broker.hivemq.com:8884/mqtt";
  let client: MqttClient;
  try {
    client = mqtt.connect(brokerUrl, { reconnectPeriod: 3000, connectTimeout: 10000, clean: true });
  } catch (error) {
    onState("disconnected", error instanceof Error ? error.message : "MQTT connection failed");
    return () => { };
  }
  onState("connecting");
  client.on("connect", () => {
    client.subscribe(LOG_TOPIC, { qos: 1 }, (error) => {
      onState(error ? "disconnected" : "connected", error?.message);
    });
  });
  client.on("reconnect", () => onState("connecting"));
  client.on("close", () => onState("disconnected"));
  client.on("error", (error) => onState("disconnected", error.message));
  client.on("message", (topic, payload) => {
    const log = parseDriverLog(topic, payload.toString());
    if (log) onLog(log);
  });
  return () => client.end(true);
}
