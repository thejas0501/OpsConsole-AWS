"use client";
import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, Loader, TrendingUp, TrendingDown,
  ArrowUpRight, ChevronDown, Calendar,
} from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

/* ── Cost Chart ──────────────────────────────────────────────────────── */
function CostLineChart({ data }: { data: { date: string; amount: number }[] }) {
  if (!data || data.length === 0)
    return <p className="text-slate-600 text-xs text-center py-8">No data for this period</p>;

  const maxVal = Math.max(...data.map((d) => d.amount), 0.01);
  const w = 700, h = 200, pad = { t: 20, r: 20, b: 30, l: 55 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const points = data.map((d, i) => ({
    x: pad.l + (i / Math.max(data.length - 1, 1)) * plotW,
    y: pad.t + plotH - (d.amount / maxVal) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath =
    linePath +
    ` L${points[points.length - 1].x},${pad.t + plotH} L${points[0].x},${pad.t + plotH} Z`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: (maxVal * f).toFixed(0),
    y: pad.t + plotH - f * plotH,
  }));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="costArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="costLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} y1={t.y} x2={w - pad.r} y2={t.y} stroke="rgba(148,163,184,.06)" strokeWidth={1} />
          <text x={pad.l - 10} y={t.y + 3} textAnchor="end" fill="#475569" fontSize={9} fontFamily="JetBrains Mono, monospace">
            ${t.val}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#costArea)" />
      <path d={linePath} fill="none" stroke="url(#costLine)" strokeWidth={2.5} strokeLinejoin="round" filter="url(#glow2)" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#030711" stroke="#06b6d4" strokeWidth={2} />
          {(data.length < 16 || i % 3 === 0) && (
            <text x={p.x} y={pad.t + plotH + 16} textAnchor="middle" fill="#475569" fontSize={8} fontFamily="JetBrains Mono, monospace">
              {new Date(p.date + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ── Month Dropdown ─────────────────────────────────────────────────── */
function MonthPicker({
  value, options, onChange,
}: { value: string | null; options: { label: string; value: string }[]; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || { label: "Last 60 Days", value: "__all" };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-cyan-500/30 text-[11px] text-slate-300 font-medium transition-all"
      >
        <Calendar size={11} className="text-cyan-400" />
        <span>{selected.label}</span>
        <ChevronDown size={11} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 right-0 w-52 bg-[#0a0f1a] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2.5 text-[11px] hover:bg-white/[0.04] border-b border-white/[0.04] transition-colors ${value === null ? "text-cyan-400 bg-cyan-500/[0.06]" : "text-slate-400"}`}
          >
            Last 60 Days (All)
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-[11px] hover:bg-white/[0.04] transition-colors ${opt.value === value ? "text-cyan-400 bg-cyan-500/[0.06]" : "text-slate-400"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────────── */
export default function CostDashboard() {
  const { region } = useRegion();
  const [data, setData] = useState<{
    overall: { date: string; amount: number; cumulative: number }[];
    services: { service: string; total: number }[];
    serviceData: { date: string; service: string; amount: number }[];
    rdsBreakdown?: { id: string; amount: number }[];
    stats?: {
      totalSpend: number; days: number; avgPerDay: number;
      last3DayAvg: number; forecast30: number; forecast60: number; forecast90: number;
      currentMonthTotal: number; currentMonthDays: number; currentMonthLabel: string;
      startDate: string; endDate: string;
    };
    availableMonths?: { label: string; value: string }[];
  }>({ overall: [], services: [], serviceData: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // null = all

  const fetchCost = useCallback(async (month: string | null) => {
    setLoading(true); setError(null);
    try {
      const url = month
        ? `/api/cost?month=${month}&region=${region}`
        : `/api/cost?region=${region}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch Cost data");
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => { fetchCost(selectedMonth); }, [fetchCost, selectedMonth]);

  const stats = data.stats;
  const availableMonths = data.availableMonths || [];

  // Compute MTD label — show current month name
  const currentMonthLabel = stats?.currentMonthLabel || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Service totals from service breakdown
  const serviceTotals: Record<string, number> = {};
  (data.services || []).forEach((s) => {
    serviceTotals[s.service] = (serviceTotals[s.service] || 0) + s.total;
  });
  const topServices = Object.entries(serviceTotals)
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost);
  const totalServiceSpend = topServices.reduce((a, b) => a + b.cost, 0);

  // Daily table
  const dailyCosts = [...data.overall]
    .map((r, i) => {
      const prev = i > 0 ? data.overall[i - 1].amount : r.amount;
      const change = prev > 0 ? ((r.amount - prev) / prev) * 100 : 0;
      return { date: r.date, amount: r.amount, change };
    })
    .reverse();

  const barColors = ["#06b6d4", "#8b5cf6", "#f43f5e", "#f97316", "#10b981", "#eab308", "#ec4899", "#3b82f6", "#14b8a6", "#ef4444"];

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">

      {/* Header */}
      <div className="flex items-center justify-between glass-card p-5 py-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <DollarSign size={18} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Cost Monitoring</h2>
            <p className="text-[11px] text-slate-600 font-medium">
              {selectedMonth ? `Viewing: ${availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}` : "Last 60 days · All figures from AWS Cost Explorer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex flex-col items-end">
              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.15em]">Avg Daily</span>
              <span className="text-lg font-bold text-white font-mono-brand">${stats.avgPerDay.toFixed(2)}</span>
            </div>
          )}
          <MonthPicker value={selectedMonth} options={availableMonths} onChange={setSelectedMonth} />
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-600 flex flex-col items-center gap-3">
          <Loader size={24} className="animate-spin text-cyan-500/50" />
          <span className="text-[12px]">Querying AWS Cost Explorer…</span>
        </div>
      )}
      {error && (
        <div className="glass-card border-rose-500/20 text-rose-400 rounded-xl p-4 text-[12px] text-center">
          Error: {error}
        </div>
      )}

      {!loading && !error && stats && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* April / Current Month MTD — always pinned */}
            <div className="glass-card rounded-xl p-4 border border-cyan-500/15">
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">{currentMonthLabel} MTD</p>
              <p className="text-2xl font-bold text-cyan-400 font-mono-brand mt-1">
                ${stats.currentMonthTotal.toFixed(2)}
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">
                {stats.currentMonthDays} day{stats.currentMonthDays !== 1 ? "s" : ""} · ${stats.currentMonthDays > 0 ? (stats.currentMonthTotal / stats.currentMonthDays).toFixed(2) : "0.00"}/day
              </p>
            </div>

            <div className="glass-card rounded-xl p-4">
              <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">Period Total</p>
              <p className="text-2xl font-bold text-white font-mono-brand mt-1">${stats.totalSpend.toFixed(2)}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">{stats.days} days tracked</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">3-Day Avg</p>
              <p className="text-2xl font-bold text-amber-400 font-mono-brand mt-1">${stats.last3DayAvg.toFixed(2)}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">per day</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">30-Day Forecast</p>
              <p className="text-2xl font-bold text-violet-400 font-mono-brand mt-1">${stats.forecast30.toFixed(2)}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">projected</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">Services</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono-brand mt-1">{topServices.length}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">tracked this period</p>
            </div>
          </div>

          {/* Cost Chart */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-white font-semibold text-[13px] flex items-center gap-2 mb-5">
              <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center">
                <TrendingUp size={12} className="text-cyan-400" />
              </div>
              Daily Spend
              <span className="text-[10px] text-slate-600 ml-1">
                {stats.startDate} → {stats.endDate}
              </span>
            </h3>
            <CostLineChart data={data.overall} />
          </div>

          {/* Service Breakdown Table */}
          {topServices.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h3 className="text-white font-semibold text-[13px] flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                    <DollarSign size={12} className="text-violet-400" />
                  </div>
                  Cost by Service
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["#", "Service Name", "Period Cost", "% of Total", "Daily Avg", "Bar"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[9px] text-slate-600 font-bold uppercase tracking-[0.15em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topServices.map((svc, i) => {
                    const pct = totalServiceSpend > 0 ? (svc.cost / totalServiceSpend) * 100 : 0;
                    const dailyAvg = stats.days > 0 ? svc.cost / stats.days : 0;
                    const cleanName = svc.name.replace("Amazon ", "").replace("AWS ", "");
                    return (
                      <tr key={svc.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-[10px] text-slate-600 font-mono-brand">{i + 1}</td>
                        <td className="px-5 py-3 text-[12px] text-white font-medium">
                          <span title={svc.name}>{cleanName}</span>
                        </td>
                        <td className="px-5 py-3 text-[12px] font-mono-brand font-bold text-white">${svc.cost.toFixed(4)}</td>
                        <td className="px-5 py-3 text-[11px] font-mono-brand text-slate-400">{pct.toFixed(1)}%</td>
                        <td className="px-5 py-3 text-[11px] font-mono-brand text-slate-500">${dailyAvg.toFixed(4)}</td>
                        <td className="px-5 py-3 w-40">
                          <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                background: `linear-gradient(90deg, ${barColors[i % barColors.length]}, ${barColors[i % barColors.length]}80)`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-white/[0.015]">
                    <td className="px-5 py-3" />
                    <td className="px-5 py-3 text-[12px] text-slate-400 font-bold">Total</td>
                    <td className="px-5 py-3 text-[12px] font-mono-brand font-bold text-cyan-400">${totalServiceSpend.toFixed(4)}</td>
                    <td className="px-5 py-3 text-[11px] font-mono-brand text-slate-500">100%</td>
                    <td className="px-5 py-3 text-[11px] font-mono-brand text-slate-500">${stats.avgPerDay.toFixed(4)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Daily Cost Table */}
          {dailyCosts.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h3 className="text-white font-semibold text-[13px] flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center">
                    <TrendingDown size={12} className="text-cyan-400" />
                  </div>
                  Daily Cost Breakdown
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#080d18]">
                    <tr className="border-b border-white/[0.04]">
                      {["Date", "Day Spend", "Change", "Trend"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[9px] text-slate-600 font-bold uppercase tracking-[0.15em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dailyCosts.map((d) => (
                      <tr key={d.date} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-2.5 text-[11px] text-slate-400 font-mono-brand">
                          {new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", {
                            weekday: "short", day: "2-digit", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-2.5 text-[12px] font-mono-brand font-bold text-white">${d.amount.toFixed(4)}</td>
                        <td className="px-5 py-2.5">
                          <span className={`flex items-center gap-1 text-[10px] font-bold font-mono-brand ${d.change > 0 ? "text-rose-400" : d.change < 0 ? "text-emerald-400" : "text-slate-600"}`}>
                            {d.change > 0 ? <ArrowUpRight size={10} /> : d.change < 0 ? <TrendingDown size={10} /> : null}
                            {d.change !== 0 ? `${d.change > 0 ? "+" : ""}${d.change.toFixed(1)}%` : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 w-32">
                          <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                              style={{
                                width: `${data.overall.length > 0 ? (d.amount / Math.max(...data.overall.map((x) => x.amount), 0.001)) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
