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

## Dashboard and live location

### Liquid Glass appearance

The bottom-right **Light mode / Dark mode** switch pairs a bright landscape and Liquid Glass panels in light mode with a deeper background and opaque panels in dark mode. Light mode is the initial default; your choice is remembered locally. The glass uses smooth, low-amplitude SVG displacement, without geometric bevel seams or corner diamonds. Reflections track the pointer on devices with a fine pointer, unless reduced motion is enabled. Foreground text, charts, and maps are never filtered. Browsers without SVG backdrop filters use the CSS blur material. Increased-contrast mode retains solid panels in either theme.

Design references: [Liquid Glass Design](https://liquidglassdesign.com/what-is-liquid-glass) and [Apple's material guidance](https://developer.apple.com/design/human-interface-guidelines/materials). This is a web approximation of the optical material, not Apple's native renderer.

The overview includes a fleet-status ring, today's recorded driving time by driver, live/alert filters, and a location preview in each driver card. Select **Track driver** for an interactive map, contact details, and paginated signal history. Dragging the map pauses automatic following; **Follow driver** recenters on the latest coordinates and resumes tracking.

Maps use Leaflet with OpenStreetMap tiles and require internet access, with no map API key. Attribution remains visible. Follow the [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/) when deploying; use a suitable tile provider for larger fleets.

The browser subscribes to `/waspada/logs/+` over the configured MQTT WebSocket connection. Each JSON message contains numeric `latitude` and `longitude`, boolean `drowsy`, and an ISO `timestamp`. The topic suffix must match the driver's registered Raspberry Pi ID. A new message updates that driver's map marker in place. Invalid coordinates are ignored. Duplicate or older device timestamps cannot move the latest marker backwards.

A location is labeled **Live location** only while MQTT is connected and the latest received signal is less than two minutes old. Otherwise, the map retains the **Last known location**. Saved coordinates are loaded from Supabase on page load and driver-list refresh. Drivers without coordinates show a waiting state. Charts use actual registered-driver data, not sample values; activity history is limited to the latest 100 messages in this browser session.

**GPS input:** the current Python publisher uses the fixed `--mqtt-latitude` and `--mqtt-longitude` arguments supplied at startup. The dashboard follows any changing coordinates it receives, but real vehicle movement requires the Pi publisher to obtain and send fresh GPS readings. No GPS hardware integration is implied by the map.
