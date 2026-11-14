"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Tone = {
  oscillator: OscillatorNode;
  gain: GainNode;
};

type BuzzerRuntime = {
  context: AudioContext;
  intervalId: number | null;
  tones: Set<Tone>;
};

/**
 * Produces a repeating in-browser buzzer while the drowsiness signal is active.
 * `unlockAudio` must be called from a user gesture because browsers block
 * automatic audio until the page has been interacted with.
 */
export function useDrowsinessBuzzer(active: boolean) {
  const runtime = useRef<BuzzerRuntime | null>(null);
  const activeRef = useRef(active);
  const [audioReady, setAudioReady] = useState(false);
  activeRef.current = active;

  const playPulse = useCallback((context: AudioContext) => {
    const current = runtime.current;
    if (!current || context.state !== "running") return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const tone = { oscillator, gain };

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(920, now);
    oscillator.frequency.linearRampToValueAtTime(680, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.015);
    gain.gain.setValueAtTime(0.24, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    current.tones.add(tone);
    oscillator.onended = () => {
      current.tones.delete(tone);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }, []);

  const stopAlarm = useCallback(() => {
    const current = runtime.current;
    if (!current) return;
    if (current.intervalId !== null) {
      window.clearInterval(current.intervalId);
      current.intervalId = null;
    }
    current.tones.forEach(({ oscillator }) => {
      try { oscillator.stop(); } catch { /* The pulse may already have ended. */ }
    });
    current.tones.clear();
  }, []);

  const startAlarm = useCallback(() => {
    const current = runtime.current;
    if (!current || current.intervalId !== null) return;
    void current.context.resume().then(() => {
      if (!activeRef.current || !runtime.current || runtime.current.intervalId !== null) return;
      setAudioReady(true);
      playPulse(current.context);
      current.intervalId = window.setInterval(() => playPulse(current.context), 620);
    }).catch(() => setAudioReady(false));
  }, [playPulse]);

  const unlockAudio = useCallback(() => {
    if (!runtime.current) {
      const AudioContextConstructor = window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      runtime.current = {
        context: new AudioContextConstructor(),
        intervalId: null,
        tones: new Set(),
      };
    }
    void runtime.current.context.resume().then(() => {
      setAudioReady(true);
      if (activeRef.current) startAlarm();
    }).catch(() => setAudioReady(false));
  }, [startAlarm]);

  useEffect(() => {
    if (active) startAlarm();
    else stopAlarm();
  }, [active, startAlarm, stopAlarm]);

  useEffect(() => () => {
    stopAlarm();
    const context = runtime.current?.context;
    runtime.current = null;
    if (context && context.state !== "closed") void context.close();
  }, [stopAlarm]);

  return { audioReady, unlockAudio };
}
