"use client";

import { useEffect, useRef } from "react";
import { defaultWheel, type PedalBinding, type WheelSettings } from "@/lib/simulator/input";

export type PadSnapshot = { index: number; id: string; axes: number[]; buttons: number[]; mapping: string };
export function WheelSettingsDialog({ settings, pads, onChange, onClose }: { settings: WheelSettings; pads: PadSnapshot[]; onChange: (s: WheelSettings) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const pad = pads.find(p => p.index === settings.device);
  function pedal(name: "throttle" | "brake", patch: Partial<PedalBinding>) { onChange({ ...settings, [name]: { ...settings[name], ...patch } }); }
  return <dialog className="sim-dialog" ref={dialog} onCancel={onClose} aria-labelledby="wheel-title">
    <div className="sim-dialog-head"><div><span className="sim-kicker">HARDWARE SETUP</span><h2 id="wheel-title">Make the wheel your own.</h2></div><button onClick={onClose} aria-label="Close wheel settings">✕</button></div>
    <p>Connect your FANTECH R1V2, then press a wheel button to make it visible. Use its PC mode and check each input below. Settings stay on this browser.</p>
    <label className="sim-check"><input type="checkbox" checked={settings.enabled} onChange={e => onChange({ ...settings, enabled: e.target.checked })} /> Use steering wheel input</label>
    <label className="sim-field">Controller<select value={pad ? settings.device : ""} onChange={e => onChange({ ...settings, device: Number(e.target.value) })}><option value="" disabled>No selected controller detected</option>{pads.map(p => <option key={p.index} value={p.index}>{p.index}: {p.id}</option>)}</select></label>
    <div className="sim-config-grid">
      <label className="sim-field">Steering axis<input type="number" min="0" max="63" value={settings.steeringAxis} onChange={e => onChange({ ...settings, steeringAxis: Math.max(0, Math.min(63, Math.round(Number(e.target.value)))) })} /></label>
      <label className="sim-field">Wheel rotation<select value={settings.rotation} onChange={e => onChange({ ...settings, rotation: Number(e.target.value) })}>{[180, 270, 360, 540, 900, 1080].map(n => <option key={n} value={n}>{n}°</option>)}</select></label>
      <label className="sim-field">Dead zone · {Math.round(settings.deadzone * 100)}%<input type="range" min="0" max=".3" step=".01" value={settings.deadzone} onChange={e => onChange({ ...settings, deadzone: Number(e.target.value) })} /></label>
      <label className="sim-field">Sensitivity · {settings.sensitivity.toFixed(2)}<input type="range" min=".25" max="2" step=".05" value={settings.sensitivity} onChange={e => onChange({ ...settings, sensitivity: Number(e.target.value) })} /></label>
    </div>
    <div className="sim-config-actions"><label className="sim-check"><input type="checkbox" checked={settings.invert} onChange={e => onChange({ ...settings, invert: e.target.checked })} /> Invert steering</label><button disabled={!pad} onClick={() => onChange({ ...settings, center: Math.max(-.9, Math.min(.9, pad?.axes[settings.steeringAxis] ?? 0)) })}>Set current position as center</button></div>
    <div className="sim-pedal-grid">{(["throttle", "brake"] as const).map(name => <fieldset key={name}><legend>{name === "throttle" ? "Accelerator" : "Brake"}</legend><div className="sim-config-grid"><label className="sim-field">Source<select value={settings[name].source} onChange={e => pedal(name, { source: e.target.value as "axis" | "button" })}><option value="button">Button</option><option value="axis">Axis</option></select></label><label className="sim-field">Index<input type="number" min="0" max="63" value={settings[name].index} onChange={e => pedal(name, { index: Math.max(0, Math.min(63, Math.round(Number(e.target.value)))) })} /></label></div><div className="sim-pedal-capture"><button disabled={!pad} onClick={() => pedal(name, { rest: (settings[name].source === "axis" ? pad?.axes : pad?.buttons)?.[settings[name].index] ?? 0 })}>Capture released</button><button disabled={!pad} onClick={() => pedal(name, { pressed: (settings[name].source === "axis" ? pad?.axes : pad?.buttons)?.[settings[name].index] ?? 1 })}>Capture pressed</button></div><small>Released {settings[name].rest.toFixed(2)} → pressed {settings[name].pressed.toFixed(2)}</small>{Math.abs(settings[name].rest - settings[name].pressed) < .05 && <p className="sim-warning">Release and press must have different readings.</p>}</fieldset>)}</div>
    <div className="sim-raw"><strong>Live input monitor <small>{pad?.mapping || "unmapped"}</small></strong><div>{pad ? pad.axes.map((v, i) => <span key={i}>A{i} <b>{v.toFixed(2)}</b></span>) : <p>No controller detected. Try another PC input mode, then press a button. Keyboard driving is available.</p>}</div><div>{pad?.buttons.map((v, i) => <span className={v > .1 ? "pressed" : ""} key={i}>B{i} <b>{v.toFixed(2)}</b></span>)}</div></div>
    <p className="sim-small">Starter mapping: axis 0, accelerator B7, brake B6. Confirm using the live monitor; this is a configurable gamepad mapping, not a verified R1V2 driver. Force feedback and the H-pattern shifter are not implemented.</p>
    <div className="sim-dialog-footer"><button onClick={() => onChange({ ...defaultWheel, enabled: settings.enabled, device: settings.device })}>Reset mapping</button><button className="sim-primary" onClick={onClose}>Save & close</button></div>
  </dialog>;
}
