"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Icon } from "./icon";

export type MapLocation = { latitude: number; longitude: number; receivedAt: string };
type Props = { location?: MapLocation; name: string; live: boolean; drowsy?: boolean; compact?: boolean };

export default function DriverMap({ location, name, live, drowsy, compact = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.CircleMarker | null>(null);
  const latest = useRef({ location, live, drowsy });
  latest.current = { location, live, drowsy };
  const follow = useRef(true);
  const [following, setFollowing] = useState(true);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const valid = Boolean(location && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180);

  useEffect(() => {
    if (!valid || !container.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    import("leaflet").then((L) => {
      if (disposed || !container.current || !latest.current.location) return;
      const point = latest.current.location;
      const instance = L.map(container.current, { zoomControl: !compact, dragging: !compact, scrollWheelZoom: false, doubleClickZoom: !compact, touchZoom: !compact, boxZoom: !compact, keyboard: !compact, zoomAnimation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches }).setView([point.latitude, point.longitude], compact ? 13 : 15);
      map.current = instance;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }).addTo(instance);
      tiles.on("tileerror", () => { if (!disposed) setError(true); });
      tiles.on("tileload", () => { if (!disposed) setError(false); });
      marker.current = L.circleMarker([point.latitude, point.longitude], { radius: compact ? 8 : 10, color: "#fff", weight: 3, fillColor: latest.current.live ? (latest.current.drowsy ? "#bd583c" : "#267a60") : "#78847d", fillOpacity: 1 }).addTo(instance);
      instance.on("dragstart", () => { follow.current = false; setFollowing(false); });
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      setReady(true);
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; observer?.disconnect(); map.current?.remove(); map.current = null; marker.current = null; };
  }, [valid, compact]);

  useEffect(() => {
    if (!valid || !location || !map.current || !marker.current) return;
    const point: Leaflet.LatLngTuple = [location.latitude, location.longitude];
    marker.current.setLatLng(point).setStyle({ fillColor: live ? (drowsy ? "#bd583c" : "#267a60") : "#78847d" });
    if (follow.current) map.current.panTo(point, { animate: false });
  }, [valid, location?.latitude, location?.longitude, location, live, drowsy, ready]);

  if (!valid) return <div className={"map-empty " + (compact ? "compact" : "")}><Icon name="pin" size={compact ? 23 : 30} /><strong>Waiting for location</strong><span>The next device signal will place {name.split(" ")[0]} on the map.</span></div>;
  return <div className={"driver-map " + (compact ? "compact" : "")}>
    <div ref={container} className="map-canvas" aria-label={`Location of ${name}`} />
    <span className={"map-state " + (live ? "is-live" : "")}><span className="status-dot" />{live ? "Live location" : "Last known location"}</span>
    {!compact && <button className={"map-follow " + (following ? "is-following" : "")} type="button" aria-pressed={following} onClick={() => {
      follow.current = !following; setFollowing(!following);
      if (!following && location) map.current?.panTo([location.latitude, location.longitude], { animate: false });
    }}><Icon name="pin" size={15} />{following ? "Following driver" : "Follow driver"}</button>}
    {!ready && !error && <div className="map-loading">Loading map…</div>}
    {error && <div className="map-error" role="status">Map tiles unavailable. Coordinates are still updating.</div>}
  </div>;
}
