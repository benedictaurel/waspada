# Waspada driving simulator

Run `pnpm dev` from `waspada-ui`, then open <http://localhost:3000/simulator>.
The cockpit fills the browser viewport. Press **F** or choose **Fullscreen** in
the pause menu to hide browser chrome too. All menus appear inside the game.
The simulator has no detector, MQTT, Supabase, alert, or session-export integrations.
The existing fleet dashboard is separate and unchanged.

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
| `creditsImage` | Image URL for the 3:4 portrait dashboard screen |
| `spawn` | Starting X/Z coordinates in metres and heading in radians |

Put `credits.png` in `public/simulator/` and set `creditsImage` to
`"/simulator/credits.png"`. Images fit without cropping. Reload after editing;
when using `pnpm start`, run `pnpm build` and restart to apply source changes.

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
