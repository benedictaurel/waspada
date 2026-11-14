# Waspada driving simulator

Run `pnpm dev` from `waspada-ui`, then open <http://localhost:3000/simulator>.
The cockpit fills the browser viewport. Press **F** or choose **Fullscreen** in
the pause menu to hide browser chrome too. All menus appear inside the game.

## Raspberry Pi drowsiness alert

The infotainment display normally shows a music player. It changes to a flashing
**WAKE UP** warning and sounds a repeating in-browser buzzer whenever the selected
Raspberry Pi publishes `drowsy: true`. Publishing `drowsy: false` restores the
music player and stops the buzzer. The existing fleet dashboard is unchanged.

The detector and simulator must use the same broker. Set the broker URL in
`.env.local` and either preselect the Pi or enter its ID in the simulator's pause
menu:

```dotenv
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
NEXT_PUBLIC_SIMULATOR_RASPI_ID=10000000abcdef01
```

The ID is printed by the detector as `[MQTT] Publishing as ...`. It can also be
selected without changing environment configuration by opening
`/simulator?raspiId=10000000abcdef01`. The simulator subscribes only to
`/waspada/logs/<RaspiUniqueID>`; it does not listen to every device on the public
broker. Start the detector with MQTT enabled, for example:

```powershell
python -m drowsiness_pipeline.main --mqtt --mqtt-latitude -6.2 --mqtt-longitude 106.8
```

Browser autoplay rules require one click/tap before sound can play. The simulator
unlocks its Web Audio buzzer when the driver presses Start/Resume or interacts
with the driving view.

## Scene configuration — edit this file

**`lib/simulator/config.ts`** is the main configuration file:

| Setting | What it changes |
| --- | --- |
| `timeOfDay` | `"daylight"` or `"dusk"` |
| `traffic` | Enable or disable traffic |
| `trafficCount` | Number of traffic vehicles; default 12 |
| `citySeed` | Seed for procedural buildings and trees |
| `fieldOfView` | Forward camera field of view in degrees |
| `eyeHeight` | Camera height in metres |
| `speedLimitKmh` | Advisory dashboard speed-limit sign |
| `spawn` | Starting X/Z coordinates in metres and heading in radians |

Reload after editing; when using `pnpm start`, run `pnpm build` and restart to
apply source changes.

For deeper changes, `lib/simulator/world.ts` builds the city, materials, roads,
traffic, and lighting. `lib/simulator/physics.ts` controls acceleration, braking,
steering, drag, collision boundaries, and road coordinates. Cockpit appearance
is in `components/simulator/driving-simulator.tsx` and `app/simulator/simulator.css`.

## Controls

- **Enter** / Start driving: start or resume.
- **W/S** or **Up/Down**: accelerate / brake.
- **A/D** or **Left/Right**: steer.
- **R** or the dashboard D/R indicator: change drive/reverse at **any speed**.
  The selected gear changes immediately; momentum slows before the car moves
  in the new direction. Keep accelerating to move in the selected direction.
- **Space**: handbrake. **Q/E**: look left/right.
- **P/Escape**: pause and open the in-game menu. Reset is in that menu.
- **F2**: wheel setup. **F**: toggle native browser fullscreen.

Changing tabs, losing window focus, and disconnecting an active wheel pause the
simulation. Clicking Start/Resume focuses the driving view. The rear camera
shows the live scene behind the vehicle.

## FANTECH R1V2 setup

1. Connect the wheel and pedals using the manufacturer's PC setup instructions.
   Use localhost or HTTPS in a desktop browser with WebGL 2 and gamepad support.
2. Press **F2** or select **Wheel setup** from the pause menu, then press a
   physical wheel button to make the device visible. Select it and enable input.
3. Check the live axis/button monitor. Starter mapping: axis 0 for steering,
   B7 for accelerator, B6 for brake. These are generic defaults; confirm the
   indices for your wheel's active PC mode.
4. Center the wheel and click **Set current position as center**. Set inversion,
   dead zone, sensitivity, and wheel rotation to match your physical wheel.
5. Set each pedal's source and index. Capture its released reading and then its
   fully pressed reading. Inverted axes, shared axes, and analog buttons work.
6. Save & close, then resume. Keyboard inputs remain available, including **R**
   for D/R selection. Settings persist in this browser's localStorage.

Changing PC input mode can change the device layout/index. Force feedback,
clutch, and the H-pattern shifter are not implemented. Actual R1V2 compatibility
still needs a test with your connected device.

The city is 600 × 600 metres, with simplified traffic and vehicle dynamics.
Traffic follows lanes, stops for signals and a player ahead, and reverses at
city boundaries. It does not have general pathfinding or car-to-car avoidance.

## Validation

`pnpm test:simulator` tests dynamics, moving gear changes, collisions, and wheel
calibration. Use `pnpm lint`, `pnpm typecheck`, and `pnpm build` for app checks.
