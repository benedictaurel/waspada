"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultWheel, readKeyboard, readWheel, validSettings, type WheelSettings } from "@/lib/simulator/input";
import { spawnVehicle, stepVehicle, type DriveInput, type Vehicle } from "@/lib/simulator/physics";
import { simulatorConfig } from "@/lib/simulator/config";
import { createCity } from "@/lib/simulator/world";
import { WheelSettingsDialog, type PadSnapshot } from "./wheel-settings";

const zeroInput: DriveInput = { steering: 0, throttle: 0, brake: 0, handbrake: false };
const timeLabel = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

export function DrivingSimulator() {
  const canvas = useRef<HTMLCanvasElement>(null), stage = useRef<HTMLDivElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const keys = useRef(new Set<string>()), vehicle = useRef(spawnVehicle());
  const runtime = useRef({ running: false, reverse: false, elapsed: 0, wheel: defaultWheel, settingsOpen: false, ready: false });
  const [running, setRunning] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState("");
  const [car, setCar] = useState<Vehicle>(spawnVehicle), [elapsed, setElapsed] = useState(0), [input, setInput] = useState(zeroInput);
  const [reverse, setReverse] = useState(false);
  const [wheel, setWheel] = useState<WheelSettings>(defaultWheel), [pads, setPads] = useState<PadSnapshot[]>([]), [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const pause = useCallback(() => { runtime.current.running = false; keys.current.clear(); setRunning(false); }, []);
  const toggleRun = useCallback(() => {
    if (!runtime.current.ready || runtime.current.settingsOpen) return;
    if (runtime.current.running) pause();
    else { runtime.current.running = true; setRunning(true); setNotice(""); stage.current?.focus(); }
  }, [pause]);
  function reset() {
    pause(); vehicle.current = spawnVehicle(); runtime.current.elapsed = 0; runtime.current.reverse = false;
    setReverse(false); setCar({ ...vehicle.current }); setElapsed(0); setNotice("");
  }
  // Selecting a gear is immediate at any speed. Physics smoothly changes direction.
  function changeGear() { runtime.current.reverse = !runtime.current.reverse; setReverse(runtime.current.reverse); }
  const openWheelSettings = useCallback(() => { pause(); runtime.current.settingsOpen = true; setSettingsOpen(true); }, [pause]);
  function closeWheelSettings() { runtime.current.settingsOpen = false; setSettingsOpen(false); stage.current?.focus(); }
  function toggleFullscreen() {
    const action = document.fullscreenElement ? document.exitFullscreen() : stage.current?.requestFullscreen();
    void action?.catch(() => setNotice("Browser fullscreen is unavailable. The simulator still fills this window."));
  }
  function saveWheel(s: WheelSettings) { setWheel(s); runtime.current.wheel = s; try { localStorage.setItem("waspada-wheel-v1", JSON.stringify(s)); } catch { setNotice("Wheel settings work this session; browser storage is unavailable."); } }

  useEffect(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem("waspada-wheel-v1") || "null"); if (validSettings(saved)) { setWheel(saved); runtime.current.wheel = saved; } } catch { /* Use the safe defaults. */ }
  }, []);
  useEffect(() => {
    if (!canvas.current || !stage.current) return;
    const session = runtime.current;
    let city: ReturnType<typeof createCity>;
    try { city = createCity(canvas.current); } catch { setError("The 3D view could not start. Enable hardware acceleration and open this page in a WebGL 2 capable browser."); return; }
    const view = stage.current;
    let mirrorRect: { x: number; y: number; width: number; height: number } | undefined;
    const observer = new ResizeObserver(() => {
      city.resize(view.clientWidth, view.clientHeight);
      if (mirror.current) {
        const a = view.getBoundingClientRect(), b = mirror.current.getBoundingClientRect();
        mirrorRect = { x: b.left - a.left + 5, y: b.top - a.top + 5, width: b.width - 10, height: b.height - 10 };
      }
    }); observer.observe(view);
    city.resize(view.clientWidth, view.clientHeight);
    setReady(true); runtime.current.ready = true;
    view.focus();
    let last = 0, uiTime = 0, hadController = false;
    const onBlur = () => pause();
    const onVisibility = () => { if (document.hidden) pause(); };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, select, textarea, button, a, dialog")) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyQ", "KeyE"].includes(event.code)) { event.preventDefault(); keys.current.add(event.code); }
      if (event.repeat) return;
      if (event.code === "KeyP" || event.code === "Escape") { event.preventDefault(); pause(); }
      if (event.code === "Enter") { event.preventDefault(); toggleRun(); }
      if (event.code === "F2") { event.preventDefault(); openWheelSettings(); }
      if (event.code === "KeyF") { event.preventDefault(); toggleFullscreen(); }
      if (event.code === "KeyR") changeGear();
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const contextLost = (event: Event) => { event.preventDefault(); pause(); runtime.current.ready = false; setReady(false); setError("The graphics connection was interrupted. Reload this page to restart the simulator."); };
    canvas.current.addEventListener("webglcontextlost", contextLost);
    const canvasNode = canvas.current;
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("blur", onBlur); document.addEventListener("visibilitychange", onVisibility);
    city.renderer.setAnimationLoop((timestamp: number) => {
      const dt = last ? Math.min((timestamp - last) / 1000, .05) : 0; last = timestamp;
      const rt = runtime.current;
      let gamepads: (Gamepad | null)[] = [];
      try { gamepads = Array.from(navigator.getGamepads?.() ?? []); } catch { /* The keyboard is available in restricted browser contexts. */ }
      const pad = gamepads[rt.wheel.device];
      const keyboard = readKeyboard(keys.current);
      let controls = keyboard;
      if (rt.wheel.enabled && pad?.connected) {
        const physical = readWheel(pad, rt.wheel);
        controls = { steering: keyboard.steering || physical.steering, throttle: Math.max(physical.throttle, keyboard.throttle), brake: Math.max(physical.brake, keyboard.brake), handbrake: keyboard.handbrake };
      }
      if (hadController && rt.wheel.enabled && !pad?.connected) { pause(); setNotice("Wheel disconnected. Reconnect it or disable wheel input to continue with the keyboard."); }
      hadController = rt.wheel.enabled && !!pad?.connected;
      if (rt.running) {
        rt.elapsed += dt;
        city.updateTraffic(dt, rt.elapsed, simulatorConfig.traffic, vehicle.current);
        const collision = stepVehicle(vehicle.current, controls, dt, rt.reverse, [...city.obstacles, ...city.getTrafficObstacles()]);
        if (collision) setNotice("Contact detected. Brake, reverse, or reset the session to reposition.");
      } else { city.updateTraffic(0, rt.elapsed, simulatorConfig.traffic, vehicle.current); }
      const look = Number(keys.current.has("KeyQ")) * .55 - Number(keys.current.has("KeyE")) * .55;
      city.draw(vehicle.current, look, simulatorConfig.timeOfDay === "dusk", mirrorRect);
      if (timestamp - uiTime > 100) {
        uiTime = timestamp; setCar({ ...vehicle.current }); setElapsed(rt.elapsed); setInput(controls);
        setPads(gamepads.filter((p): p is Gamepad => !!p && p.connected).map(p => ({ index: p.index, id: p.id, axes: Array.from(p.axes), buttons: p.buttons.map(b => b.value), mapping: p.mapping })));
      }
    });
    return () => { session.ready = false; observer.disconnect(); city.dispose(); canvasNode.removeEventListener("webglcontextlost", contextLost); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur); document.removeEventListener("visibilitychange", onVisibility); };
  }, [openWheelSettings, pause, toggleRun]);

  const speed = Math.round(Math.abs(car.speed) * 3.6), controller = pads.find(p => p.index === wheel.device);
  return <main className="sim-app">
    <div className="sim-stage" ref={stage} tabIndex={0} aria-label="First person driving view. W or up to accelerate, S or down to brake, A and D to steer, R to switch drive and reverse at any speed, P to pause.">
      <canvas ref={canvas} className="sim-world" aria-label="Three dimensional city" />
        <div className="sim-mirror" ref={mirror}><span>REAR CAMERA</span></div>
        <div className="sim-pillar sim-pillar-left" /><div className="sim-pillar sim-pillar-right" />
        <div className="sim-hood" />
        <div className="sim-cockpit"><div className="sim-dash-seam" /><div className="sim-vent sim-vent-left" /><div className="sim-instruments"><div className="sim-gauge"><span>POWER</span><div className="sim-gauge-arc" /><b>{Math.round(input.throttle * 100)}<small>%</small></b></div><div className="sim-speed"><button className="sim-gear" onClick={() => { changeGear(); stage.current?.focus(); }} aria-label="Switch drive / reverse (R)">{reverse ? "R" : "D"}</button><strong>{speed.toString().padStart(2, "0")}</strong><small>km/h</small><div>{(car.distance / 1000).toFixed(2)} km <span>•</span> {timeLabel(elapsed)}</div></div><div className="sim-gauge"><span>LIMIT</span><div className="sim-limit">{simulatorConfig.speedLimitKmh}</div><small>DRIVE MINDFULLY</small></div></div>
          <div className="sim-steering" style={{ transform: `rotate(${car.steering * wheel.rotation / 2}deg)` }}><svg viewBox="0 0 320 320" aria-label="Steering wheel"><defs><linearGradient id="wheel-rim" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#4b5555" /><stop offset=".5" stopColor="#12191b" /><stop offset="1" stopColor="#363e3f" /></linearGradient></defs><circle cx="160" cy="160" r="136" fill="none" stroke="#090f11" strokeWidth="38" /><circle cx="160" cy="160" r="137" fill="none" stroke="url(#wheel-rim)" strokeWidth="29" /><circle cx="160" cy="160" r="118" fill="none" stroke="#66716c" strokeWidth="1" /><path d="M36 137 125 145 195 145 285 137 278 173 192 184 183 284 137 284 127 184 43 173Z" fill="#242d2f" stroke="#6a7673" strokeWidth="3" /><path d="m148 213 12 55 13-55" fill="none" stroke="#77817c" strokeWidth="4" /><rect x="112" y="119" width="96" height="88" rx="33" fill="#323d3e" stroke="#141e20" strokeWidth="3" /><path d="M158 11h4v17h-4z" fill="#d7b77d" /></svg></div>
          <div className="sim-center-console"><div className="sim-credits-screen"><Image src={simulatorConfig.creditsImage} width={600} height={800} unoptimized alt="Dashboard credits image" /></div><div className="sim-console-knobs"><i /><span>WASPADA</span><i /></div></div><div className="sim-vent sim-vent-right" />
        </div>

      {!running && ready && !error && !settingsOpen && <div className="sim-paused">
        <span>{elapsed > 0 ? "PAUSED" : "WASPADA · DRIVING SIMULATOR"}</span>
        <button className="sim-start" onClick={toggleRun}>▶ {elapsed > 0 ? "Resume drive" : "Start driving"}</button>
        <div className="sim-menu-actions"><button onClick={openWheelSettings}>Wheel setup · F2</button><button onClick={reset}>Reset drive</button><button onClick={toggleFullscreen}>Fullscreen · F</button></div>
        <small>{wheel.enabled && controller ? "Wheel connected" : wheel.enabled ? "Wheel not detected — keyboard available" : "Keyboard ready · FANTECH R1V2 setup available"}</small>
        <div className="sim-key-help">W / S · accelerate / brake<br />A / D · steer &nbsp; R · drive / reverse<br />Space · handbrake &nbsp; Q / E · look<br />Enter · resume &nbsp; P / Esc · pause</div>
      </div>}
      {!ready && !error && <div className="sim-loading">Building your city…</div>}
      {error && <div className="sim-loading" role="alert">{error}</div>}
      {notice && <div className="sim-notice" role="status">{notice}<button onClick={() => { setNotice(""); stage.current?.focus(); }} aria-label="Dismiss notification">✕</button></div>}
      <div className="sim-view-bottom"><button onClick={pause}>Ⅱ Menu · Esc</button><button onClick={toggleFullscreen} aria-label="Toggle fullscreen">⛶</button></div>
      {settingsOpen && <WheelSettingsDialog settings={wheel} pads={pads} onChange={saveWheel} onClose={closeWheelSettings} />}
    </div>
  </main>;
}
