"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const SURFACES = ".sidebar, .metric-card, .panel, .driver-card, .form-card, .detail-modal, .topbar";
type Theme = "light" | "dark";

/** Light uses smooth glass; dark uses solid surfaces. Content is never filtered. */
export function GlassMaterial() {
  const [theme, setTheme] = useState<Theme>("light");
  const pathname = usePathname();
  const loginIsDarkOnly = pathname === "/login";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("waspada-theme");
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch { /* Theme switching also works without storage. */ }
  }, []);

  useEffect(() => {
    const activeTheme: Theme = loginIsDarkOnly ? "dark" : theme;
    document.body.dataset.theme = activeTheme;
    document.documentElement.style.colorScheme = activeTheme;
    document.body.dataset.glass = activeTheme === "light" ? "on" : "off";
    if (activeTheme === "dark") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const supportsRefraction = CSS.supports("backdrop-filter", 'url("#liquid-refraction")');
    const surfaces = new Map<HTMLElement, HTMLDivElement>();
    let frame = 0;
    let activeSurface: HTMLElement | null = null;

    function syncSurfaces() {
      for (const [node, layer] of surfaces) {
        if (!node.isConnected) { layer.remove(); surfaces.delete(node); }
      }
      document.querySelectorAll<HTMLElement>(SURFACES).forEach((node) => {
        if (surfaces.has(node) || !supportsRefraction) return;
        const layer = document.createElement("div");
        layer.className = "glass-optics";
        layer.setAttribute("aria-hidden", "true");
        node.prepend(layer);
        node.classList.add("has-refraction");
        surfaces.set(node, layer);
      });
    }
    syncSurfaces();
    const mutations = new MutationObserver(syncSurfaces);
    mutations.observe(document.body, { childList: true, subtree: true });

    function onPointerMove(event: PointerEvent) {
      if (reduceMotion.matches || !finePointer.matches) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(SURFACES) : null;
      if (activeSurface !== target) activeSurface?.style.removeProperty("--glass-glint");
      activeSurface = target;
      cancelAnimationFrame(frame);
      if (!target) return;
      frame = requestAnimationFrame(() => {
        const bounds = target.getBoundingClientRect();
        target.style.setProperty("--glass-x", `${event.clientX - bounds.left}px`);
        target.style.setProperty("--glass-y", `${event.clientY - bounds.top}px`);
        target.style.setProperty("--glass-glint", "1");
      });
    }
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      mutations.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onPointerMove);
      for (const [node, layer] of surfaces) {
        layer.remove(); node.classList.remove("has-refraction");
        for (const property of ["--glass-glint", "--glass-x", "--glass-y"]) node.style.removeProperty(property);
      }
    };
  }, [loginIsDarkOnly, theme]);

  if (loginIsDarkOnly) return null;

  return <>
    <svg className="glass-filter-definitions" aria-hidden="true" focusable="false"><defs>
      {/* Smooth, low-amplitude refraction avoids the previous geometric bevel seams. */}
      <filter id="liquid-refraction" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008" numOctaves="1" seed="8" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="4" result="smooth-noise" />
        <feDisplacementMap in="SourceGraphic" in2="smooth-noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs></svg>
    <button className="glass-preference" type="button" role="switch" aria-checked={theme === "dark"} aria-label="Dark mode" title={theme === "light" ? "Switch to dark mode with solid panels" : "Switch to light mode with Liquid Glass"} onClick={() => {
      const next = theme === "light" ? "dark" : "light";
      setTheme(next);
      try { localStorage.setItem("waspada-theme", next); } catch { /* Persistence is optional. */ }
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        {theme === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 m-3-9-1.4 1.4 M5.4 18.6 4 20 M4 4l1.4 1.4 M18.6 18.6 20 20" /></> : <path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z" />}
      </svg>
      {theme === "light" ? "Light mode" : "Dark mode"}<span className="glass-switch" />
    </button>
  </>;
}
