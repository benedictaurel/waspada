import { clamp, type DriveInput } from "./physics";

export type PedalBinding = { source: "button" | "axis"; index: number; rest: number; pressed: number };
export type WheelSettings = { enabled: boolean; device: number; steeringAxis: number; center: number; invert: boolean; deadzone: number; sensitivity: number; rotation: number; throttle: PedalBinding; brake: PedalBinding };
export const defaultWheel: WheelSettings = { enabled: false, device: 0, steeringAxis: 0, center: 0, invert: false, deadzone: .04, sensitivity: 1, rotation: 270, throttle: { source: "button", index: 7, rest: 0, pressed: 1 }, brake: { source: "button", index: 6, rest: 0, pressed: 1 } };
export function pedalValue(pad: Pick<Gamepad, "axes" | "buttons">, binding: PedalBinding): number {
  const raw = binding.source === "axis" ? pad.axes[binding.index] : pad.buttons[binding.index]?.value;
  if (raw === undefined || !Number.isFinite(raw) || Math.abs(binding.pressed - binding.rest) < .05) return 0;
  return clamp((raw - binding.rest) / (binding.pressed - binding.rest), 0, 1);
}
export function readWheel(pad: Pick<Gamepad, "axes" | "buttons">, settings: WheelSettings): DriveInput {
  const raw = pad.axes[settings.steeringAxis] ?? settings.center;
  const offset = raw - settings.center;
  const normalized = offset / Math.max(.1, offset >= 0 ? 1 - settings.center : 1 + settings.center);
  const steering = Math.sign(normalized) * Math.max(0, Math.abs(normalized) - settings.deadzone) / (1 - settings.deadzone);
  return { steering: clamp(steering * settings.sensitivity * (settings.invert ? -1 : 1), -1, 1), throttle: pedalValue(pad, settings.throttle), brake: pedalValue(pad, settings.brake), handbrake: false };
}
export function readKeyboard(keys: Set<string>): DriveInput {
  return { steering: Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft")), throttle: Number(keys.has("KeyW") || keys.has("ArrowUp")), brake: Number(keys.has("KeyS") || keys.has("ArrowDown")), handbrake: keys.has("Space") };
}
export function validSettings(value: unknown): value is WheelSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as WheelSettings;
  const finite = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
  const pedal = (p: PedalBinding) => p && ["button", "axis"].includes(p.source) && Number.isInteger(p.index) && finite(p.index, 0, 63) && finite(p.rest, -1, 1) && finite(p.pressed, -1, 1);
  return typeof s.enabled === "boolean" && typeof s.invert === "boolean" && Number.isInteger(s.device) && finite(s.device, 0, 15) && Number.isInteger(s.steeringAxis) && finite(s.steeringAxis, 0, 63) && finite(s.center, -.9, .9) && finite(s.deadzone, 0, .3) && finite(s.sensitivity, .25, 2) && finite(s.rotation, 90, 1080) && !!pedal(s.throttle) && !!pedal(s.brake);
}
