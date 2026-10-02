import { simulatorConfig } from "./config";

export const ROADS = [-240, -120, 0, 120, 240];
export const WORLD_EDGE = 295;
export type DriveInput = { steering: number; throttle: number; brake: number; handbrake: boolean };
export type Vehicle = { x: number; z: number; heading: number; speed: number; steering: number; distance: number; collisions: number; contact: boolean };
export type Obstacle = { x: number; z: number; halfX: number; halfZ: number };
export const spawnVehicle = (): Vehicle => ({ ...simulatorConfig.spawn, speed: 0, steering: 0, distance: 0, collisions: 0, contact: false });
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const isRoad = (x: number, z: number) => ROADS.some(r => Math.abs(x - r) < 10 || Math.abs(z - r) < 10);

// Metres, seconds and radians. A bicycle model with speed-dependent steering.
// Substeps prevent tunnelling through buildings after a slow frame.
export function stepVehicle(car: Vehicle, input: DriveInput, dt: number, reverse: boolean, obstacles: Obstacle[]): boolean {
  const count = Math.max(1, Math.ceil(clamp(dt, 0, .1) / (1 / 120)));
  const h = clamp(dt, 0, .1) / count;
  let hit = false;
  const nearObstacle = Math.abs(car.x) > WORLD_EDGE - .3 || Math.abs(car.z) > WORLD_EDGE - .3 || obstacles.some(o => Math.abs(car.x - o.x) < o.halfX + 1.45 && Math.abs(car.z - o.z) < o.halfZ + 1.45);
  if (!nearObstacle) car.contact = false;
  for (let i = 0; i < count; i++) {
    car.steering += (clamp(input.steering, -1, 1) - car.steering) * (1 - Math.exp(-h * 9));
    const direction = reverse ? -1 : 1;
    const drag = .12 * Math.abs(car.speed) + .006 * car.speed * car.speed + (isRoad(car.x, car.z) ? .35 : 2.8);
    const braking = clamp(input.brake, 0, 1) * 10 + (input.handbrake ? 18 : 0);
    const engine = clamp(input.throttle, 0, 1) * (reverse ? 3 : 4.5) * direction;
    const old = car.speed;
    car.speed += engine * h;
    car.speed = Math.sign(car.speed) * Math.max(0, Math.abs(car.speed) - (drag + braking) * h);
    if (old * direction < -.1) car.speed = Math.sign(old) * Math.max(0, Math.abs(old) - (braking + 6) * h);
    car.speed = clamp(car.speed, -8, 30);
    car.heading -= car.speed / 2.7 * Math.tan(car.steering * .48 / (1 + Math.abs(car.speed) * .045)) * h;
    const x = car.x - Math.sin(car.heading) * car.speed * h;
    const z = car.z - Math.cos(car.heading) * car.speed * h;
    const blocked = Math.abs(x) > WORLD_EDGE || Math.abs(z) > WORLD_EDGE || obstacles.some(o => Math.abs(x - o.x) < o.halfX + 1.15 && Math.abs(z - o.z) < o.halfZ + 1.15);
    if (blocked) { if (Math.abs(car.speed) > .8) hit = true; car.speed = 0; }
    else { car.distance += Math.hypot(x - car.x, z - car.z); car.x = x; car.z = z; }
  }
  const newContact = hit && !car.contact;
  if (newContact) car.collisions++;
  if (hit) car.contact = true;
  return newContact;
}
