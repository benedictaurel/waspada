import { formatDuration } from "@/lib/serviceTime";
import type { Driver } from "@/lib/types";

export function FleetInsights({ drivers, safe, alerts, dailyTotals }: { drivers: Driver[]; safe: number; alerts: number; dailyTotals: Record<string, number> }) {
  const waiting = Math.max(0, drivers.length - safe - alerts);
  const total = drivers.length;
  const segments = [{ label: "Alert & active", count: safe, color: "var(--chart-safe)" }, { label: "Drowsy alert", count: alerts, color: "var(--chart-alert)" }, { label: "No live signal", count: waiting, color: "var(--chart-idle)" }];
  let offset = 0;
  const ranked = [...drivers].sort((a, b) => (dailyTotals[b.raspi_unique_id] || 0) - (dailyTotals[a.raspi_unique_id] || 0)).slice(0, 5);
  const max = Math.max(1, ...ranked.map((driver) => dailyTotals[driver.raspi_unique_id] || 0));
  return <div className="insights-grid">
    <section className="panel fleet-health"><div className="panel-header"><div><p className="panel-kicker">THE BIG PICTURE</p><h2>Fleet at a glance</h2></div><span className="quiet-chip">Right now</span></div>
      <div className="health-content"><div className="donut-wrap"><svg viewBox="0 0 180 180" role="img" aria-label={`${safe} active, ${alerts} drowsy, ${waiting} without a live signal`}><circle cx="90" cy="90" r="69" fill="none" stroke="#e2e8e2" strokeWidth="17" />{segments.map((segment) => {
        const length = total ? segment.count / total * 433.54 : 0;
        const start = offset; offset += length;
        return length > 0 ? <circle key={segment.label} cx="90" cy="90" r="69" fill="none" stroke={segment.color} strokeWidth="17" strokeDasharray={`${Math.max(0, length - (length < 433 ? 4 : 0))} 433.54`} strokeDashoffset={-start} transform="rotate(-90 90 90)" /> : null;
      })}</svg><div className="donut-label"><strong>{total ? Math.round((safe + alerts) / total * 100) + "%" : "—"}</strong><span>reporting live</span></div></div>
      <div className="chart-legend">{segments.map((segment) => <div key={segment.label}><span className="legend-dot" style={{ background: segment.color }} /><span>{segment.label}</span><strong>{segment.count}</strong></div>)}<p>A signal is live for 2 minutes after receipt.</p></div></div>
    </section>
    <section className="panel driving-panel"><div className="panel-header"><div><p className="panel-kicker">TIME ON THE ROAD</p><h2>Today’s driving time</h2></div><span className="quiet-chip">Top 5 drivers</span></div>
      <div className="driving-chart">{ranked.length ? ranked.map((driver) => {
        const value = dailyTotals[driver.raspi_unique_id] || 0;
        return <div className="driving-row" key={driver.driver_id}><div><span title={driver.name}>{driver.name}</span><strong>{formatDuration(value)}</strong></div><div className="bar-track" role="img" aria-label={`${driver.name}: ${formatDuration(value)} today`}><span style={{ width: `${value / max * 100}%` }} /></div></div>;
      }) : <div className="chart-empty"><span className="empty-bars"><i /><i /><i /><i /><i /></span><p>Your fleet’s driving time will take shape here.</p></div>}</div><p className="chart-footnote">Recorded device activity · Resets at midnight</p>
    </section>
  </div>;
}
