"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { subscribeToDriverLogs, type MqttConnectionState } from "@/lib/mqttService";
import { formatDuration, serviceDate } from "@/lib/serviceTime";
import type { Driver, DriverLog } from "@/lib/types";

const LIVE_LIMIT = 100;
const HISTORY_PAGE_SIZE = 25;

type StoredLog = {
  id: number;
  raspi_unique_id: string;
  latitude: number;
  longitude: number;
  drowsy: boolean;
  device_timestamp: string;
  received_at: string;
  payload: Record<string, unknown>;
};

type DisplayLog = {
  key: string;
  latitude: number;
  longitude: number;
  drowsy: boolean;
  timestamp: string;
  receivedAt: string;
  payload: Record<string, unknown>;
  live: boolean;
};

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return String(seconds) + "s ago";
  if (seconds < 3600) return String(Math.floor(seconds / 60)) + "m ago";
  return String(Math.floor(seconds / 3600)) + "h ago";
}

function StatusPill({ log, now }: { log?: DriverLog; now: number }) {
  if (!log) return <span className="status-pill status-idle"><span className="status-dot" /> Awaiting signal</span>;
  if (now - Date.parse(log.receivedAt) > 120000) {
    return <span className="status-pill status-idle"><span className="status-dot" /> Signal lost</span>;
  }
  return log.drowsy
    ? <span className="status-pill status-danger"><span className="status-dot" /> Drowsy alert</span>
    : <span className="status-pill status-safe"><span className="status-dot" /> Alert & active</span>;
}

export default function Dashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [liveLogs, setLiveLogs] = useState<DriverLog[]>([]);
  const [connection, setConnection] = useState<MqttConnectionState>("connecting");
  const [mqttError, setMqttError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [dailyTotals, setDailyTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [history, setHistory] = useState<StoredLog[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyRequest = useRef(0);
  const configured = Boolean(getSupabase());

  const loadDrivers = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoadError("Add your Supabase URL and key to .env.local to load drivers.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) setLoadError(error.message);
    else {
      setDrivers((data || []) as Driver[]);
      setLoadError("");
    }
  }, []);

  const loadDailyTotals = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("driver_daily_service")
      .select("raspi_unique_id,active_seconds")
      .eq("service_date", serviceDate(new Date()));
    if (error) { setServiceError(error.message); return; }
    setDailyTotals(Object.fromEntries((data || []).map((row) => [row.raspi_unique_id, Number(row.active_seconds)])));
    setServiceError("");
  }, []);

  useEffect(() => { void loadDrivers(); void loadDailyTotals(); }, [loadDrivers, loadDailyTotals]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(Date.now());
      void loadDailyTotals();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadDailyTotals]);
  useEffect(() => subscribeToDriverLogs(
    (log) => setLiveLogs((current) => [log, ...current].slice(0, LIVE_LIMIT)),
    (state, error) => { setConnection(state); setMqttError(error || ""); },
  ), []);

  const latestById = useMemo(() => {
    const latest = new Map<string, DriverLog>();
    for (const log of liveLogs) if (!latest.has(log.raspiUniqueId)) latest.set(log.raspiUniqueId, log);
    return latest;
  }, [liveLogs]);
  const filtered = useMemo(() => drivers.filter((driver) =>
    (driver.name + " " + driver.plate_number + " " + driver.raspi_unique_id)
      .toLowerCase().includes(search.toLowerCase().trim()),
  ), [drivers, search]);
  const selected = drivers.find((driver) => driver.driver_id === selectedId) || null;
  const selectedSerial = selected?.raspi_unique_id || null;
  const selectedLog = selectedSerial ? latestById.get(selectedSerial) : undefined;
  const knownIds = useMemo(() => new Set(drivers.map((driver) => driver.raspi_unique_id)), [drivers]);
  const matchedLogs = liveLogs.filter((log) => knownIds.has(log.raspiUniqueId));

  const fetchHistory = useCallback(async (serial: string, cursor: number | null, append: boolean, request: number) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setHistoryLoading(true);
    setHistoryError("");
    let query = supabase.from("driver_logs")
      .select("id,raspi_unique_id,latitude,longitude,drowsy,device_timestamp,received_at,payload")
      .eq("raspi_unique_id", serial)
      .order("id", { ascending: false })
      .limit(HISTORY_PAGE_SIZE);
    if (cursor !== null) query = query.lt("id", cursor);
    const { data, error } = await query;
    if (request !== historyRequest.current) return;
    setHistoryLoading(false);
    if (error) { setHistoryError(error.message); return; }
    const rows = (data || []) as StoredLog[];
    setHistory((current) => append ? [...current, ...rows] : rows);
    setHistoryCursor(rows.length > 0 ? rows[rows.length - 1].id : cursor);
    setHistoryHasMore(rows.length === HISTORY_PAGE_SIZE);
  }, []);

  useEffect(() => {
    const request = ++historyRequest.current;
    setHistory([]);
    setHistoryCursor(null);
    setHistoryHasMore(false);
    setHistoryError("");
    setHistoryLoading(false);
    if (selectedSerial) void fetchHistory(selectedSerial, null, false, request);
    return () => { historyRequest.current += 1; };
  }, [selectedSerial, fetchHistory]);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId]);

  const displayedHistory = useMemo(() => {
    if (!selectedSerial) return [];
    const selectedHistory = history.filter((row) => row.raspi_unique_id === selectedSerial);
    const storedTimes = new Set(selectedHistory.map((row) => row.device_timestamp));
    const seenLive = new Set<string>();
    const currentLive: DisplayLog[] = liveLogs
      .filter((log) => log.raspiUniqueId === selectedSerial && !storedTimes.has(log.timestamp))
      .filter((log) => {
        if (seenLive.has(log.timestamp)) return false;
        seenLive.add(log.timestamp);
        return true;
      })
      .map((log) => ({
        key: "live-" + log.timestamp,
        latitude: log.latitude,
        longitude: log.longitude,
        drowsy: log.drowsy,
        timestamp: log.timestamp,
        receivedAt: log.receivedAt,
        payload: {
          latitude: log.latitude, longitude: log.longitude,
          drowsy: log.drowsy, timestamp: log.timestamp,
        },
        live: true,
      }));
    const stored: DisplayLog[] = selectedHistory.map((row) => ({
      key: "stored-" + row.id,
      latitude: row.latitude,
      longitude: row.longitude,
      drowsy: row.drowsy,
      timestamp: row.device_timestamp,
      receivedAt: row.received_at,
      payload: row.payload,
      live: false,
    }));
    return [...currentLive, ...stored].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  }, [selectedSerial, liveLogs, history]);

  const latestLocation = selectedLog ||
    (history[0]?.raspi_unique_id === selectedSerial ? history[0] : undefined);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">W</span><span>WASPADA</span></Link>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <Link className="nav-item active" href="/"><span>▦</span> Overview</Link>
          <Link className="nav-item" href="/add-driver"><span>＋</span> Add driver</Link>
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Operations <span>/</span> Overview</div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><p className="eyebrow">LIVE OPERATIONS CENTER</p><h1>Driver overview</h1><p className="subheading">Monitor your registered drivers activity</p></div>
            <Link href="/add-driver" className="primary-button"><span>＋</span> Add new driver</Link>
          </div>

          {!configured && <div className="notice">Supabase is not configured. Fill in <code>waspada-ui/.env.local</code>, then restart the app.</div>}
          {loadError && configured && <div className="notice error">Could not load drivers: {loadError} <button onClick={() => void loadDrivers()}>Retry</button></div>}
          {mqttError && <div className="notice error">MQTT: {mqttError}</div>}
          {serviceError && <div className="notice error">Could not load today’s driving time: {serviceError}</div>}

          <section className="overview-row" aria-label="Fleet overview">
            <div className="metric-card total-drivers-card">
              <div className="metric-icon blue">▦</div>
              <span>Total drivers</span>
              <strong>{drivers.length}</strong>
              <small>Registered device units</small>
            </div>
            <section className="panel activity-panel">
              <div className="panel-header">
                <div><h2>Live activity</h2><p>Messages from all registered device units</p></div>
                <span className="live-label"><span className="status-dot" /> LIVE</span>
              </div>
              <div className="activity-list">
                {matchedLogs.map((log, index) => {
                  const driver = drivers.find((item) => item.raspi_unique_id === log.raspiUniqueId);
                  return (
                    <button className="activity-item" key={log.raspiUniqueId + "-" + log.receivedAt + "-" + index}
                      onClick={() => { if (driver) setSelectedId(driver.driver_id); }} type="button">
                      <span className={"activity-symbol " + (log.drowsy ? "danger" : "safe")}>{log.drowsy ? "!" : "✓"}</span>
                      <span className="activity-copy">
                        <strong>{log.drowsy ? "Drowsiness detected" : "Driver reporting normally"}</strong>
                        <span>{driver?.name || log.raspiUniqueId} · {driver?.plate_number || "Unknown vehicle"}</span>
                        <small>{relativeTime(log.receivedAt)} · {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</small>
                      </span>
                    </button>
                  );
                })}
                {matchedLogs.length === 0 && <div className="activity-empty"><span>◉</span><strong>Waiting for telemetry</strong><p>Messages from registered Pi units will appear here.</p></div>}
              </div>
            </section>
          </section>

          <section className="driver-section">
            <div className="section-heading">
              <div><h2>Drivers</h2><p>Select a driver to view their details and MQTT log history.</p></div>
              <div className="section-tools">
                <label className="search-box"><span>⌕</span><input type="search" placeholder="Search name, plate, or Pi ID" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <button className="text-button" onClick={() => void loadDrivers()} disabled={loading}>↻ Refresh</button>
              </div>
            </div>
            {loading && <div className="empty-state">Loading drivers…</div>}
            {!loading && filtered.length === 0 && <div className="empty-state">
              <span>◌</span><strong>{search ? "No matches found" : "No drivers yet"}</strong>
              <p>{search ? "Try another name, plate, or Pi ID." : "Add a driver to begin monitoring your fleet."}</p>
              {!search && <Link href="/add-driver" className="secondary-button">Add first driver</Link>}
            </div>}
            <div className="driver-grid">
              {filtered.map((driver) => {
                const log = latestById.get(driver.raspi_unique_id);
                return (
                  <button className="driver-card" type="button" key={driver.driver_id} onClick={() => setSelectedId(driver.driver_id)}>
                    <span className="driver-card-top"><span className="driver-avatar">{driver.name.slice(0, 1).toUpperCase()}</span><span className="driver-card-arrow">↗</span></span>
                    <strong className="driver-card-name">{driver.name}</strong>
                    <span className="driver-card-plate">{driver.plate_number}</span>
                    <span className="driver-card-footer"><StatusPill log={log} now={clock} /><span>{formatDuration(dailyTotals[driver.raspi_unique_id] || 0)} today</span></span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {selected && <div className="modal-backdrop" onMouseDown={() => setSelectedId(null)}>
        <section className="detail-modal driver-detail-modal" role="dialog" aria-modal="true" aria-label={selected.name + " details"} onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Close details">×</button>
          <p className="eyebrow">DRIVER PROFILE</p>
          <h2>{selected.name}</h2>
          <p className="modal-subtitle">{selected.plate_number} · Device ID: {selected.raspi_unique_id}</p>
          <StatusPill log={selectedLog} now={clock} />
          <div className="detail-grid">
            <div><span>Mobile number</span><strong>{selected.mobile_number}</strong></div>
            <div><span>Emergency contact</span><strong>{selected.emergency_contact}</strong></div>
            <div><span>Driving today</span><strong>{formatDuration(dailyTotals[selected.raspi_unique_id] || 0)}</strong></div>
          </div>
          {latestLocation && <div className="location-box">
            <span>LAST KNOWN LOCATION</span>
            <strong>{latestLocation.latitude.toFixed(5)}, {latestLocation.longitude.toFixed(5)}</strong>
            <a href={"https://www.openstreetmap.org/?mlat=" + latestLocation.latitude + "&mlon=" + latestLocation.longitude + "#map=15/" + latestLocation.latitude + "/" + latestLocation.longitude}
              target="_blank" rel="noopener noreferrer">Open map ↗</a>
          </div>}
          <div className="history-header">
            <span>{history.length} stored loaded</span>
          </div>
          <div className="history-list">
            {displayedHistory.map((log) => <article className="log-entry" key={log.key}>
              <div className="log-entry-head">
                <span className={"activity-symbol " + (log.drowsy ? "danger" : "safe")}>{log.drowsy ? "!" : "✓"}</span>
                <div><strong>{log.drowsy ? "Drowsiness detected" : "Driver reporting normally"}</strong><small>{new Date(log.timestamp).toLocaleString()}</small></div>
                {log.live && <span className="live-log-tag">LIVE</span>}
              </div>
              <p>Coordinates: {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</p>
              <details className="raw-log"><summary>View payload</summary><pre>{JSON.stringify(log.payload, null, 2)}</pre></details>
            </article>)}
            {historyLoading && <div className="history-state">Loading logs…</div>}
            {historyError && <div className="notice error">Could not load logs: {historyError} <button onClick={() => { if (selectedSerial) void fetchHistory(selectedSerial, historyCursor, history.length > 0, historyRequest.current); }}>Retry</button></div>}
            {!historyLoading && !historyError && displayedHistory.length === 0 && <div className="history-state">No logs recorded for this device yet.</div>}
          </div>
          {historyHasMore && !historyLoading && <button className="secondary-button load-more-button" onClick={() => { if (selectedSerial && historyCursor !== null) void fetchHistory(selectedSerial, historyCursor, true, historyRequest.current); }}>Load older logs</button>}
        </section>
      </div>}
    </div>
  );
}
