# Waspada dashboard

Driver registration stores identity and contact details. Driving time is calculated from consecutive Raspberry Pi MQTT heartbeats, which arrive every five seconds by default. A gap longer than 15 seconds is treated as a stop; missing time is not counted. The total resets at midnight in NEXT_PUBLIC_OPERATIONS_TIME_ZONE (default: Asia/Jakarta). Running the detector is treated as driving; the current telemetry has no ignition or vehicle-motion signal.

## Setup
1. Copy .env.example to .env.local and fill in the Supabase URL, publishable (anon) key, and service role key.
```
cp .env.example .env.local
```

2. Copy supabase/schema.sql to Supabase SQL editor.

3. Run the following commands to setup the dashboard:
```
pnpm install
pnpm dev
pnpm ingest
```

`pnpm ingest` is used to ingest the data from the MQTT broker to Supabase, add a driver using their Raspberry Pi serial ID. The dashboard refreshes the daily total every 15 seconds.