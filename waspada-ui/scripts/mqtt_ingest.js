#!/usr/bin/env node
// Run continuously: node --env-file=.env.local scripts/mqtt_ingest.js
// Keep SUPABASE_SERVICE_ROLE_KEY on this server. Never expose it in the browser.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mqtt = require("mqtt");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || url.includes("your-project") || key.startsWith("your-")) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const timeZone = process.env.NEXT_PUBLIC_OPERATIONS_TIME_ZONE || "Asia/Jakarta";
const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "wss://broker.hivemq.com:8884/mqtt";
const supabase = createClient(url, key, { auth: { persistSession: false } });
const client = mqtt.connect(brokerUrl, { reconnectPeriod: 3000, connectTimeout: 10000 });
client.on("connect", () => {
  client.subscribe("/waspada/logs/+", { qos: 1 }, (error) => {
    if (error) console.error("MQTT subscribe:", error.message);
    else console.log("Recording driver MQTT logs from", brokerUrl);
  });
});
client.on("error", (error) => console.error("MQTT:", error.message));
client.on("message", async (topic, payload) => {
  const match = /^\/waspada\/logs\/([A-Za-z0-9_-]+)$/.exec(topic);
  if (!match) return;
  try {
    const log = JSON.parse(payload.toString());
    if (!log || typeof log.drowsy !== "boolean" ||
        typeof log.latitude !== "number" || !Number.isFinite(log.latitude) || log.latitude < -90 || log.latitude > 90 ||
        typeof log.longitude !== "number" || !Number.isFinite(log.longitude) || log.longitude < -180 || log.longitude > 180 ||
        typeof log.timestamp !== "string" || !Number.isFinite(Date.parse(log.timestamp))) return;
    // Use server receipt time in the SQL function, not the device's adjustable clock.
    const { error } = await supabase.rpc("record_driver_log", {
      p_raspi_unique_id: match[1], p_payload: log, p_time_zone: timeZone,
    });
    if (error) console.error("Log for " + match[1] + ":", error.message);
  } catch {
    // Ignore malformed messages on the shared broker.
  }
});
process.on("SIGINT", () => { client.end(); process.exit(0); });
process.on("SIGTERM", () => { client.end(); process.exit(0); });
