"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { subscribeToDriverLogs, type MqttConnectionState } from "@/lib/mqttService";
import { formatDuration, serviceDate } from "@/lib/serviceTime";
import type { Driver, DriverLog } from "@/lib/types";
import DriverMap from "@/components/driver-map";
import { FleetInsights } from "@/components/fleet-insights";
import { Sidebar } from "@/components/sidebar";
import { Icon } from "@/components/icon";

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

function StatusPill({ log, now, connected }: { log?: DriverLog; now: number; connected: boolean }) {
  if (!log) return <span className="status-pill status-idle"><span className="status-dot" /> Awaiting signal</span>;
  if (!connected || now - Date.parse(log.receivedAt) > 120000) {
    return <span className="status-pill status-idle"><span className="status-dot" /> Signal lost</span>;
  }
  return log.drowsy
    ? <span className="status-pill status-danger"><span className="status-dot" /> Drowsy alert</span>
    : <span className="status-pill status-safe"><span className="status-dot" /> Alert & active</span>;
}

export default function Dashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [liveLogs, setLiveLogs] = useState<DriverLog[]>([]);
  const [latestById, setLatestById] = useState<Map<string, DriverLog>>(new Map());
  const [storedLocations, setStoredLocations] = useState<Record<string, DriverLog>>({});
  const [connection, setConnection] = useState<MqttConnectionState>("connecting");
  const [mqttError, setMqttError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [dailyTotals, setDailyTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "live" | "alerts">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [history, setHistory] = useState<StoredLog[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const historyRequest = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
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
    (log) => {
      setLiveLogs((current) => current.some((item) => item.raspiUniqueId === log.raspiUniqueId && item.timestamp === log.timestamp) ? current : [log, ...current].slice(0, LIVE_LIMIT));
      setLatestById((current) => {
        const previous = current.get(log.raspiUniqueId);
        if (previous && Date.parse(previous.timestamp) >= Date.parse(log.timestamp)) return current;
        return new Map(current).set(log.raspiUniqueId, log);
      });
    },
    (state, error) => { setConnection(state); setMqttError(error || ""); },
  ), []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !drivers.length) return;
    let cancelled = false;
    // One indexed latest-row lookup per driver: busy devices cannot hide others.
    void Promise.all(drivers.map(async (driver) => {
      const { data } = await supabase.from("driver_logs").select("raspi_unique_id,latitude,longitude,drowsy,device_timestamp,received_at").eq("raspi_unique_id", driver.raspi_unique_id).order("id", { ascending: false }).limit(1).maybeSingle();
      if (!data) return null;
      return [driver.raspi_unique_id, { raspiUniqueId: data.raspi_unique_id, latitude: data.latitude, longitude: data.longitude, drowsy: data.drowsy, timestamp: data.device_timestamp, receivedAt: data.received_at }] as const;
    })).then((rows) => { if (!cancelled) setStoredLocations(Object.fromEntries(rows.filter((row) => row !== null))); });
    return () => { cancelled = true; };
  }, [drivers]);

  const isLive = (log?: DriverLog) => Boolean(log && connection === "connected" && clock - Date.parse(log.receivedAt) <= 120000);
  const activeCount = drivers.filter((driver) => isLive(latestById.get(driver.raspi_unique_id))).length;
  const alertCount = drivers.filter((driver) => { const log = latestById.get(driver.raspi_unique_id); return isLive(log) && log?.drowsy; }).length;
  const totalSeconds = drivers.reduce((total, driver) => total + (dailyTotals[driver.raspi_unique_id] || 0), 0);
  const filtered = useMemo(() => drivers.filter((driver) =>
    (driver.name + " " + driver.plate_number + " " + driver.raspi_unique_id)
      .toLowerCase().includes(search.toLowerCase().trim()),
  ).filter((driver) => {
    const log = latestById.get(driver.raspi_unique_id);
    const live = Boolean(log && connection === "connected" && clock - Date.parse(log.receivedAt) <= 120000);
    return filter === "all" || (live && (filter !== "alerts" || log?.drowsy));
  }), [drivers, search, filter, latestById, connection, clock]);
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
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "Tab") {
        const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, summary, [tabindex="0"]');
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
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

  const storedLocation = history[0]?.raspi_unique_id === selectedSerial
    ? { ...history[0], receivedAt: history[0].received_at, timestamp: history[0].device_timestamp }
    : selectedSerial ? storedLocations[selectedSerial] : undefined;
  const latestLocation = selectedLog && (!storedLocation || Date.parse(selectedLog.timestamp) >= Date.parse(storedLocation.timestamp)) ? selectedLog : storedLocation;

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>Overview</strong></div>
          <div className="topbar-right"><span className={"connection " + connection} role="status"><span className="status-dot" />{connection === "connected" ? "Telemetry connected" : connection === "connecting" ? "Connecting telemetry" : "Telemetry offline"}</span><span className="avatar">OP</span></div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div><p className="eyebrow"><span className="eyebrow-line" /> FLEET OPERATIONS</p><h1>Every driver. In sight.</h1><p className="subheading">A clearer view of your fleet, and the people behind the wheel.</p></div>
            <Link href="/add-driver" className="primary-button"><Icon name="plus" size={17} /> Add driver</Link>
          </div>

          {!configured && <div className="notice">Supabase is not configured. Fill in <code>waspada-ui/.env.local</code>, then restart the app.</div>}
          {loadError && configured && <div className="notice error">Could not load drivers: {loadError} <button onClick={() => void loadDrivers()}>Retry</button></div>}
          {mqttError && <div className="notice error">MQTT: {mqttError}</div>}
          {serviceError && <div className="notice error">Could not load today’s driving time: {serviceError}</div>}

          <section className="metrics" aria-label="Fleet overview">
            <div className="metric-card"><div className="metric-heading"><span>Total drivers</span><Icon name="users" /></div><strong>{loading ? "—" : drivers.length.toString().padStart(2, "0")}</strong><small>Registered in your fleet</small></div>
            <div className="metric-card"><div className="metric-heading"><span>Reporting live</span><Icon name="pulse" /></div><strong>{activeCount.toString().padStart(2, "0")}<span className="metric-unit"> / {drivers.length}</span></strong><small><span className="status-dot green-dot" /> Devices with a recent signal</small></div>
            <div className={"metric-card " + (alertCount ? "alert-metric" : "")}><div className="metric-heading"><span>Needs attention</span><Icon name="alert" /></div><strong>{alertCount.toString().padStart(2, "0")}</strong><small>{alertCount ? "Live drowsiness alerts" : "No live drowsiness alerts"}</small></div>
            <div className="metric-card"><div className="metric-heading"><span>Driving today</span><Icon name="clock" /></div><strong className="duration-metric">{serviceError ? "—" : formatDuration(totalSeconds)}</strong><small>Across all registered drivers</small></div>
          </section>
          <FleetInsights drivers={drivers} safe={activeCount - alertCount} alerts={alertCount} dailyTotals={serviceError ? {} : dailyTotals} />
          <div className="operations-grid">
          <section className="driver-section">
            <div className="section-heading"><div><p className="panel-kicker">YOUR PEOPLE</p><h2>Driver roster <span className="count-chip">{drivers.length}</span></h2></div><button className="text-button" onClick={() => void loadDrivers()} disabled={loading}><Icon name="refresh" size={15} /> Refresh</button></div>
            <div className="roster-toolbar"><div className="filter-tabs" aria-label="Filter drivers">{([['all', 'All drivers'], ['live', 'Live'], ['alerts', 'Alerts']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={filter === value ? "selected" : ""}>{label}</button>)}</div><label className="search-box"><Icon name="search" size={16} /><input aria-label="Search drivers" type="search" placeholder="Find a driver…" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
            {loading && <div className="empty-state">Loading your fleet…</div>}
            {!loading && filtered.length === 0 && <div className="empty-state"><Icon name="users" size={30} /><strong>{search || filter !== "all" ? "No drivers in this view" : "Your fleet starts here"}</strong><p>{search || filter !== "all" ? "Try a different search or filter." : "Add your first driver to bring their journey into view."}</p>{!search && filter === "all" && <Link href="/add-driver" className="secondary-button">Add first driver <Icon name="plus" size={15} /></Link>}</div>}
            <div className="driver-grid">{filtered.map((driver) => {
              const log = latestById.get(driver.raspi_unique_id);
              const stored = storedLocations[driver.raspi_unique_id];
              const location = log && (!stored || Date.parse(log.timestamp) >= Date.parse(stored.timestamp)) ? log : stored;
              return <article className="driver-card" key={driver.driver_id}>
                <button className="driver-card-profile" onClick={() => setSelectedId(driver.driver_id)} aria-label={`View ${driver.name} details`}><span className="driver-avatar">{driver.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span className="driver-identity"><strong>{driver.name}</strong><span>{driver.plate_number}</span></span><Icon name="arrow" size={18} /></button>
                <div className="driver-card-status"><StatusPill log={log} now={clock} connected={connection === "connected"} /><span><Icon name="clock" size={12} />{formatDuration(dailyTotals[driver.raspi_unique_id] || 0)}</span></div>
                <DriverMap location={location} name={driver.name} live={isLive(log) && location === log} drowsy={log?.drowsy} compact />
                <div className="driver-card-footer"><span>{location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "No coordinates received"}</span><button onClick={() => setSelectedId(driver.driver_id)} aria-label={`Track ${driver.name}`}>Track driver <Icon name="arrow" size={13} /></button></div>
              </article>;
            })}</div>
          </section>
            <section className="panel activity-panel">
              <div className="panel-header">
                <div><p className="panel-kicker">AS IT HAPPENS</p><h2>Activity stream</h2></div>
                <span className={"live-label " + (connection !== "connected" ? "offline" : "")}><span className="status-dot" />{connection === "connected" ? "LIVE" : "OFFLINE"}</span>
              </div>
              <div className="activity-list">
                {matchedLogs.map((log, index) => {
                  const driver = drivers.find((item) => item.raspi_unique_id === log.raspiUniqueId);
                  return (
                    <button className="activity-item" key={log.raspiUniqueId + "-" + log.receivedAt + "-" + index}
                      onClick={() => { if (driver) setSelectedId(driver.driver_id); }} type="button">
                      <span className={"activity-symbol " + (log.drowsy ? "danger" : "safe")}><Icon name={log.drowsy ? "alert" : "check"} size={16} /></span>
                      <span className="activity-copy">
                        <strong>{log.drowsy ? "Drowsiness detected" : "Driver is alert"}</strong>
                        <span>{driver?.name || log.raspiUniqueId} · {driver?.plate_number || "Unknown vehicle"}</span>
                        <small>{relativeTime(log.receivedAt)} · {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</small>
                      </span>
                    </button>
                  );
                })}
                {matchedLogs.length === 0 && <div className="activity-empty"><span className="signal-orbit"><Icon name="pulse" size={25} /></span><strong>Listening for your fleet</strong><p>New signals and driver alerts<br />will appear here as they arrive.</p></div>}
              </div>
              <div className="activity-footer"><span className="status-dot" /> Latest {LIVE_LIMIT} messages · This session</div>
            </section>
          </div>
          <footer className="page-footer"><span>WASPADA <span className="footer-divider">/</span> AWARENESS IN MOTION</span><span>Built around the people on the road.</span></footer>
        </div>
      </main>

      {selected && <div className="modal-backdrop" onMouseDown={() => setSelectedId(null)}>
        <section ref={dialogRef} tabIndex={-1} className="detail-modal driver-detail-modal" role="dialog" aria-modal="true" aria-label={selected.name + " details"} onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Close details"><Icon name="close" /></button>
          <p className="eyebrow">DRIVER PROFILE</p>
          <h2>{selected.name}</h2>
          <p className="modal-subtitle">{selected.plate_number} · Device ID: {selected.raspi_unique_id}</p>
          <StatusPill log={selectedLog} now={clock} connected={connection === "connected"} />
          <div className="detail-grid">
            <div><span>Mobile number</span><strong>{selected.mobile_number}</strong></div>
            <div><span>Emergency contact</span><strong>{selected.emergency_contact}</strong></div>
            <div><span>Driving today</span><strong>{formatDuration(dailyTotals[selected.raspi_unique_id] || 0)}</strong></div>
          </div>
          <div className="detail-map-heading"><h3>Driver location</h3><span>{latestLocation ? `Received ${relativeTime(latestLocation.receivedAt)}` : "Awaiting first signal"}</span></div>
          <DriverMap key={selected.driver_id} location={latestLocation} name={selected.name} live={isLive(selectedLog) && latestLocation === selectedLog} drowsy={selectedLog?.drowsy} />
          {latestLocation && <div className="location-box">
            <span>REPORTED COORDINATES</span>
            <strong>{latestLocation.latitude.toFixed(5)}, {latestLocation.longitude.toFixed(5)}</strong>
            <a href={"https://www.openstreetmap.org/?mlat=" + latestLocation.latitude + "&mlon=" + latestLocation.longitude + "#map=15/" + latestLocation.latitude + "/" + latestLocation.longitude}
              target="_blank" rel="noopener noreferrer">Open map ↗</a>
          </div>}
          <div className="history-header">
            <h3>Signal history</h3>
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
