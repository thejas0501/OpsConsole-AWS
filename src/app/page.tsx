"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Database, Container, Box, ArrowRightLeft, Server, Zap, Shield, DollarSign, Trash2, Activity, Network, TrendingDown, Loader, ArrowUpRight, Clock, AlertTriangle, ShieldAlert, Gauge, BarChart3, TrendingUp, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

/* ─── Radial Gauge (SVG) ───────────────────────────────────────────── */
function RadialGauge({ value, label, color, size = 110 }: { value: number; label: string; color: string; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0), 100);
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth={8} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1.5s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white font-mono-brand">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
    </div>
  );
}

/* ─── Stat Card ─────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white font-mono-brand leading-tight">{value}</p>
        {sub && <p className="text-[9px] text-slate-600 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Premium Cost Chart (dual: daily bars + cumulative line) ────── */
function CostChart({ data, avgPerDay }: {
  data: { date: string; amount: number; cumulative: number }[];
  avgPerDay: number;
}) {
  if (!data || data.length === 0)
    return <p className="text-slate-600 text-xs text-center py-8">No data</p>;

  const w = 720, h = 240;
  const pad = { t: 20, r: 24, b: 40, l: 60 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const maxDaily = Math.max(...data.map(d => d.amount), 0.01);
  const maxCumulative = Math.max(...data.map(d => d.cumulative), 0.01);
  const barW = Math.max(4, (plotW / data.length) * 0.6);

  // Scale helpers
  const bx = (i: number) => pad.l + (i + 0.5) * (plotW / data.length);
  const by = (v: number) => pad.t + plotH - (v / maxDaily) * plotH;
  const cx = bx; // same x positions for cumulative line
  const cy = (v: number) => pad.t + plotH - (v / maxCumulative) * plotH;

  // Cumulative smooth path
  const cumPoints = data.map((d, i) => ({ x: cx(i), y: cy(d.cumulative) }));
  const cumPath = cumPoints
    .map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const prev = cumPoints[i - 1];
      const mx = (prev.x + p.x) / 2;
      return `C${mx},${prev.y} ${mx},${p.y} ${p.x},${p.y}`;
    })
    .join(" ");
  const cumAreaPath =
    cumPath +
    ` L${cumPoints[cumPoints.length - 1].x},${pad.t + plotH} L${cumPoints[0].x},${pad.t + plotH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: `$${(maxDaily * f).toFixed(0)}`,
    y: pad.t + plotH - f * plotH,
  }));

  // Avg per day line y
  const avgY = by(avgPerDay);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        {/* Daily bar gradient */}
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
        </linearGradient>
        {/* Cumulative area gradient */}
        <linearGradient id="cumAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
        {/* Cumulative line gradient */}
        <linearGradient id="cumLineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="barGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="lineGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} y1={t.y} x2={w - pad.r} y2={t.y}
            stroke="rgba(148,163,184,0.06)" strokeWidth={1} strokeDasharray="4 4" />
          <text x={pad.l - 8} y={t.y + 3} textAnchor="end"
            fill="#475569" fontSize={8} fontFamily="JetBrains Mono, monospace">{t.val}</text>
        </g>
      ))}

      {/* Average line (dashed) */}
      {avgPerDay > 0 && (
        <>
          <line x1={pad.l} y1={avgY} x2={w - pad.r} y2={avgY}
            stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 3" opacity={0.5} />
          <text x={w - pad.r + 4} y={avgY + 3}
            fill="#f59e0b" fontSize={7} fontFamily="JetBrains Mono, monospace">avg</text>
        </>
      )}

      {/* Daily bars */}
      {data.map((d, i) => {
        const x = bx(i);
        const barHeight = (d.amount / maxDaily) * plotH;
        return (
          <g key={i}>
            {/* Bar shadow */}
            <rect
              x={x - barW / 2 + 1} y={by(d.amount) + 2}
              width={barW} height={barHeight}
              fill="#06b6d4" opacity={0.08} rx={2}
            />
            {/* Bar */}
            <rect
              x={x - barW / 2} y={by(d.amount)}
              width={barW} height={barHeight}
              fill="url(#barGrad)" rx={3}
              filter="url(#barGlow)"
            />
            {/* X-axis label */}
            {(data.length <= 16 || i % 3 === 0) && (
              <text x={x} y={pad.t + plotH + 14} textAnchor="middle"
                fill="#475569" fontSize={7} fontFamily="JetBrains Mono, monospace">
                {new Date(d.date + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" })}
              </text>
            )}
          </g>
        );
      })}

      {/* Cumulative area */}
      <path d={cumAreaPath} fill="url(#cumAreaGrad)" />

      {/* Cumulative line */}
      <path d={cumPath} fill="none" stroke="url(#cumLineGrad)"
        strokeWidth={2.5} filter="url(#lineGlow)" />

      {/* Cumulative dots */}
      {cumPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3}
          fill="#0a0f1a" stroke="#8b5cf6" strokeWidth={2} />
      ))}

      {/* Legend */}
      <g transform={`translate(${pad.l}, ${h - 8})`}>
        <rect x={0} y={-6} width={10} height={6} fill="#06b6d4" rx={1} opacity={0.7} />
        <text x={13} y={0} fill="#64748b" fontSize={7} fontFamily="JetBrains Mono, monospace">Daily Spend</text>
        <line x1={80} y1={-3} x2={90} y2={-3} stroke="#8b5cf6" strokeWidth={2} />
        <circle cx={85} cy={-3} r={2} fill="#0a0f1a" stroke="#8b5cf6" strokeWidth={1.5} />
        <text x={93} y={0} fill="#64748b" fontSize={7} fontFamily="JetBrains Mono, monospace">Cumulative Total</text>
        <line x1={190} y1={-3} x2={200} y2={-3} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 2" opacity={0.7} />
        <text x={203} y={0} fill="#64748b" fontSize={7} fontFamily="JetBrains Mono, monospace">Avg/Day</text>
      </g>
    </svg>
  );
}

/* ─── Top Services ─────────────────────────────────────────────────── */
function TopServicesChart({ services }: { services: { service: string; total: number }[] }) {
  if (services.length === 0) return null;
  const maxVal = services[0]?.total || 1;
  const barColors = ["#06b6d4", "#8b5cf6", "#f43f5e", "#f97316", "#10b981", "#eab308"];
  return (
    <div className="flex flex-col gap-3">
      {services.slice(0, 6).map((s, i) => (
        <div key={s.service} className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-500 w-40 truncate text-right shrink-0 font-medium">{s.service.replace("Amazon ", "").replace("AWS ", "")}</span>
          <div className="flex-1 h-2 bg-white/[0.03] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${(s.total / maxVal) * 100}%`, background: `linear-gradient(90deg, ${barColors[i % barColors.length]}, ${barColors[i % barColors.length]}80)` }}
            />
          </div>
          <span className="text-slate-300 font-mono-brand w-16 text-right shrink-0 font-medium">${s.total.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Module Cards ─────────────────────────────────────────────────── */
const modules = [
  { href: "/infrastructure", icon: Network, label: "Infrastructure Flow", desc: "Visual resource flow & connections", accent: "#06b6d4" },
  { href: "/optimization", icon: TrendingDown, label: "Optimization", desc: "Cost-saving recommendations", accent: "#10b981" },
  { href: "/history", icon: Clock, label: "Failure History", desc: "Downtime events & recovery", accent: "#f43f5e" },
  { href: "/cost", icon: DollarSign, label: "Cost Monitoring", desc: "Spend breakdown & trends", accent: "#22c55e" },
  { href: "/rds", icon: Database, label: "RDS Databases", desc: "CPU, storage & cost metrics", accent: "#3b82f6" },
  { href: "/ecs", icon: Container, label: "ECS Clusters", desc: "Fargate & container health", accent: "#8b5cf6" },
  { href: "/ec2", icon: Server, label: "EC2 Instances", desc: "State, type & availability", accent: "#f97316" },
  { href: "/alb", icon: ArrowRightLeft, label: "Load Balancers", desc: "Target health & error rates", accent: "#14b8a6" },
  { href: "/s3", icon: Box, label: "S3 Storage", desc: "Bucket sizes & versioning", accent: "#eab308" },
  { href: "/elasticache", icon: Zap, label: "ElastiCache", desc: "Redis & Memcached nodes", accent: "#ec4899" },
  { href: "/security", icon: Shield, label: "Security", desc: "Security groups & IAM", accent: "#ef4444" },
  { href: "/waste", icon: Trash2, label: "Waste", desc: "Unused EBS, IPs & idle resources", accent: "#64748b" },
];

/* ─── Dashboard ────────────────────────────────────────────────────── */
export default function Dashboard() {
  type DayData = { date: string; amount: number; cumulative: number };
  const [costData, setCostData] = useState<DayData[]>([]);
  const [costStats, setCostStats] = useState<{
    totalSpend: number; days: number; avgPerDay: number;
    last3DayAvg: number; forecast30: number; forecast60: number; forecast90: number;
  } | null>(null);
  const [topServices, setTopServices] = useState<{ service: string; total: number }[]>([]);
  const [rdsBreakdown, setRdsBreakdown] = useState<{ id: string; amount: number }[]>([]);
  const [costLoading, setCostLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const { region } = useRegion();

  useEffect(() => {
    setCostLoading(true);
    setMetricsLoading(true);

    // No need to pass start/end — the API defaults to last 15 completed days
    fetch("/api/cost")
      .then(r => r.json())
      .then(d => {
        if (d.overall) setCostData(d.overall);
        if (d.stats) setCostStats(d.stats);
        if (d.services) setTopServices(d.services);
        if (d.rdsBreakdown) setRdsBreakdown(d.rdsBreakdown);
      })
      .catch(() => {})
      .finally(() => setCostLoading(false));

    fetch(`/api/overview-metrics?region=${region}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setMetrics(d); })
      .catch(() => {})
      .finally(() => setMetricsLoading(false));
  }, [region]);

  // Derive system status from API degradedSources
  const degradedSources: string[] = metrics?.degradedSources || [];
  const systemHealthy = !metricsLoading && metrics && degradedSources.length === 0;

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* ── Hero Header ──────────────────────── */}
      <div className="relative pt-2">
        <div className="flex items-center gap-2 mb-4">
          {metricsLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/[0.08] border border-slate-500/15">
              <Loader size={11} className="text-slate-400 animate-spin" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">Checking System Status…</span>
            </div>
          ) : systemHealthy ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/[0.08] border border-cyan-500/15">
              <Activity size={11} className="text-cyan-400" />
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.15em]">All Systems Operational</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/[0.08] border border-amber-500/15">
              <AlertTriangle size={11} className="text-amber-400" />
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.15em]">
                {degradedSources.length > 0
                  ? `Partial Data — ${degradedSources.join(", ").toUpperCase()} unavailable`
                  : "Checking system status…"}
              </span>
            </div>
          )}
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Cloud <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Observability</span>
        </h1>
        <p className="text-slate-500 mt-2 text-[13px] leading-relaxed max-w-xl">Real-time metrics, costs, and infrastructure health from your AWS account.</p>
      </div>

      {/* ── Cost Overview ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Cost chart */}
        <div className="lg:col-span-3 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-semibold text-[13px] flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center">
                  <DollarSign size={12} className="text-cyan-400" />
                </div>
                Cost Trend — Daily + Cumulative
              </h2>
              <p className="text-[10px] text-slate-600 mt-0.5 ml-8">Last 15 completed days · All figures from AWS Cost Explorer</p>
            </div>
            {!costLoading && costStats && (
              <div className="text-right">
                <p className="text-cyan-400 font-bold text-2xl font-mono-brand">${costStats.totalSpend.toFixed(2)}</p>
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">{costStats.days}-day total</p>
                <p className="text-[9px] text-amber-400/80 mt-0.5">${costStats.avgPerDay.toFixed(2)}/day avg</p>
              </div>
            )}
          </div>
          {costLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-600 text-sm">
              <Loader size={14} className="animate-spin text-cyan-400" /> Loading cost data…
            </div>
          ) : (
            <CostChart data={costData} avgPerDay={costStats?.avgPerDay ?? 0} />
          )}
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Top Services */}
          <div className="glass-card rounded-2xl p-5 flex-1">
            <h2 className="text-white font-semibold text-[13px] mb-5 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-violet-500/10 flex items-center justify-center">
                <TrendingDown size={12} className="text-violet-400" />
              </div>
              Top Services
            </h2>
            {costLoading ? (
              <div className="flex items-center justify-center py-8"><Loader size={14} className="animate-spin text-cyan-400" /></div>
            ) : (
              <TopServicesChart services={topServices} />
            )}
          </div>

          {/* RDS breakdown */}
          {rdsBreakdown.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-white font-semibold text-[13px] mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <Database size={12} className="text-blue-400" />
                </div>
                RDS Spend
              </h2>
              <div className="flex flex-col gap-2.5">
                {rdsBreakdown.slice(0, 5).map((r) => {
                  const name = r.id.split(':').pop()?.split('/').pop() || r.id;
                  return (
                    <div key={r.id} className="flex items-center gap-3 text-[10px]">
                      <span className="text-slate-500 w-28 truncate text-right shrink-0 font-medium" title={r.id}>{name}</span>
                      <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-blue-500 to-cyan-400"
                          style={{ width: `${(r.amount / Math.max(...rdsBreakdown.map(x => x.amount), 0.01)) * 100}%` }}
                        />
                      </div>
                      <span className="text-slate-400 font-mono-brand w-14 text-right shrink-0">${r.amount.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SRE Command Center ──────────────── */}
      {!metricsLoading && metrics && (
        <>
          {/* Anomaly Alert Banner */}
          {metrics.cost?.hasAnomaly && (
            <div className="glass-card rounded-2xl p-4 border-amber-500/20 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-amber-400 font-semibold text-[13px]">Cost Anomaly Detected</p>
                <p className="text-[11px] text-slate-500">Last 3-day average spend is {metrics.cost.anomalyPct}% higher than the 14-day average (${metrics.cost.last3DayAvg}/day vs ${metrics.cost.avgDaily}/day)</p>
              </div>
              <Link href="/cost" className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/20 transition-colors">Investigate</Link>
            </div>
          )}

          {/* SRE Health Cards */}
          <div>
            <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">SRE Command Center</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={AlertTriangle} label="Active Alerts" value={metrics.incidents?.totalAlerts ?? 0} sub={metrics.incidents?.totalAlerts > 0 ? "Needs attention" : "All clear"} color={metrics.incidents?.totalAlerts > 0 ? "#f43f5e" : "#10b981"} />
              <StatCard icon={Server} label="EC2 Running" value={`${metrics.ec2?.running}/${metrics.ec2?.total}`} sub={`${metrics.ec2?.stopped} stopped`} color="#f97316" />
              <StatCard icon={Database} label="RDS Available" value={`${metrics.rds?.available}/${metrics.rds?.total}`} sub={`Avg ${metrics.rds?.avgConnections?.toFixed(0) ?? 0} conns`} color="#3b82f6" />
              <StatCard icon={Container} label="ECS Tasks" value={`${metrics.ecs?.runningTasks}/${metrics.ecs?.desiredTasks}`} sub={`${metrics.ecs?.services} services`} color="#8b5cf6" />
              <StatCard icon={ArrowRightLeft} label="ALB Targets" value={`${metrics.alb?.healthy}/${metrics.alb?.totalTargets}`} sub={metrics.alb?.unhealthy > 0 ? `${metrics.alb.unhealthy} unhealthy` : "All healthy"} color={metrics.alb?.unhealthy > 0 ? "#f43f5e" : "#14b8a6"} />
              <StatCard icon={ShieldAlert} label="Security Risks" value={metrics.security?.riskySGs ?? 0} sub={`of ${metrics.security?.totalSGs ?? 0} groups`} color={metrics.security?.riskySGs > 0 ? "#f43f5e" : "#10b981"} />
            </div>
          </div>

          {/* SRE Signals Table */}
          {metrics.signals && metrics.signals.length > 0 && (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.04]">
                <h2 className="text-white font-semibold text-[13px] flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center"><Activity size={12} className="text-cyan-400" /></div>
                  SRE Health Signals
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["", "Signal", "Value", "Threshold", "Status"].map(h => (
                      <th key={h} className="px-5 py-2.5 text-left text-[9px] text-slate-600 font-bold uppercase tracking-[0.15em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.signals.map((s: any, i: number) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-2.5 w-8 text-[10px] font-mono-brand text-slate-600">{i}</td>
                      <td className="px-5 py-2.5 text-[12px] text-slate-300 font-medium">{s.signal}</td>
                      <td className="px-5 py-2.5 text-[12px] font-mono-brand text-white font-bold">{String(s.value)}</td>
                      <td className="px-5 py-2.5 text-[11px] font-mono-brand text-slate-500">{s.threshold}</td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                          s.status === "OK" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" :
                          s.status === "WARN" ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" :
                          "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                        }`}>
                          {s.status === "OK" ? <CheckCircle size={10} /> : s.status === "WARN" ? <AlertCircle size={10} /> : <XCircle size={10} />}
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Utilization Gauges + Efficiency Score */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Gauges */}
            <div className="lg:col-span-3 glass-card rounded-2xl p-6">
              <h2 className="text-white font-semibold text-[13px] flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center"><Gauge size={12} className="text-cyan-400" /></div>
                Resource Utilization (24h avg)
              </h2>
              <div className="flex items-center justify-around">
                <div className="relative"><RadialGauge value={metrics.ec2?.avgCpu ?? 0} label="EC2 CPU" color="#f97316" /></div>
                <div className="relative"><RadialGauge value={metrics.rds?.avgCpu ?? 0} label="RDS CPU" color="#3b82f6" /></div>
                <div className="relative"><RadialGauge value={metrics.ecs?.fillRate ?? 100} label="ECS Fill" color="#8b5cf6" /></div>
                <div className="relative"><RadialGauge value={(metrics.ec2?.avgCpu + metrics.rds?.avgCpu + metrics.ecs?.fillRate) / 3 || 0} label="Overall" color="#06b6d4" size={130} /></div>
              </div>
            </div>

            {/* Efficiency Score */}
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 flex flex-col">
              <h2 className="text-white font-semibold text-[13px] flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center"><Activity size={12} className="text-emerald-400" /></div>
                Cloud Efficiency Score
              </h2>
              <div className="flex-1 flex items-center justify-center">
                <div className="relative">
                  <RadialGauge value={metrics.efficiency?.overall ?? 0} label="" color={metrics.efficiency?.overall >= 75 ? "#10b981" : metrics.efficiency?.overall >= 50 ? "#eab308" : "#f43f5e"} size={140} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[{l:"Utilization",v:metrics.efficiency?.utilization,c:"#f97316"},{l:"Cost",v:metrics.efficiency?.costOptimization,c:"#06b6d4"},{l:"Security",v:metrics.efficiency?.security,c:"#ef4444"},{l:"Reliability",v:metrics.efficiency?.reliability,c:"#8b5cf6"}].map(i=>(                  <div key={i.l} className="flex items-center gap-2 text-[10px]">
                    <div className="w-2 h-2 rounded-full" style={{background:i.c}} />
                    <span className="text-slate-500">{i.l}</span>
                    <span className="text-white font-mono-brand ml-auto">{i.v ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Waste + Security + Cost Forecast */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Waste Summary */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-white font-semibold text-[13px] flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center"><Trash2 size={12} className="text-amber-400" /></div>
                Waste Detected
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Idle EC2 Instances</span><span className="text-white font-mono-brand font-semibold">{metrics.waste?.idleEc2 ?? 0}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Unattached EBS Volumes</span><span className="text-white font-mono-brand font-semibold">{metrics.waste?.unattachedEbs ?? 0}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Unused Elastic IPs</span><span className="text-white font-mono-brand font-semibold">{metrics.waste?.unusedEips ?? 0}</span></div>
                <div className="h-px bg-white/[0.04] my-1" />
                <div className="flex items-center justify-between"><span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Est. Monthly Waste</span><span className="text-amber-400 font-bold font-mono-brand text-lg">${metrics.waste?.estimatedWaste ?? 0}</span></div>
              </div>
              <Link href="/waste" className="mt-4 block text-center text-[10px] text-cyan-500 hover:text-cyan-400 font-semibold uppercase tracking-wider transition-colors">View Full Report →</Link>
            </div>

            {/* Security Summary */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-white font-semibold text-[13px] flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-rose-500/10 flex items-center justify-center"><Shield size={12} className="text-rose-400" /></div>
                Security Posture
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Total Security Groups</span><span className="text-white font-mono-brand font-semibold">{metrics.security?.totalSGs ?? 0}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Open to Internet (0.0.0.0/0)</span><span className={`font-mono-brand font-semibold ${metrics.security?.riskySGs > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{metrics.security?.riskySGs ?? 0}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-500">Unhealthy ALB Targets</span><span className={`font-mono-brand font-semibold ${metrics.alb?.unhealthy > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{metrics.alb?.unhealthy ?? 0}</span></div>
                <div className="h-px bg-white/[0.04] my-1" />
                <div className="flex items-center justify-between"><span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Security Score</span><span className={`font-bold font-mono-brand text-lg ${(metrics.efficiency?.security ?? 0) >= 75 ? 'text-emerald-400' : (metrics.efficiency?.security ?? 0) >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{metrics.efficiency?.security ?? 0}/100</span></div>
              </div>
              <Link href="/security" className="mt-4 block text-center text-[10px] text-cyan-500 hover:text-cyan-400 font-semibold uppercase tracking-wider transition-colors">View Details →</Link>
            </div>

            {/* Cost Forecast */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="text-white font-semibold text-[13px] flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center"><TrendingUp size={12} className="text-cyan-400" /></div>
                Cost Forecast
              </h2>
              <div className="flex flex-col gap-4">
                {[{d:"30 days",v:metrics.cost?.forecast30},{d:"60 days",v:metrics.cost?.forecast60},{d:"90 days",v:metrics.cost?.forecast90}].map(f => {
                  const max90 = metrics.cost?.forecast90 || 1;
                  return (
                    <div key={f.d} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">{f.d}</span>
                        <span className="text-white font-mono-brand font-bold">${(f.v ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000" style={{ width: `${((f.v ?? 0) / max90) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="h-px bg-white/[0.04] my-1" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Daily Avg</span>
                  <span className="text-cyan-400 font-bold font-mono-brand">${metrics.cost?.avgDaily ?? 0}/day</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {metricsLoading && (
        <div className="glass-card rounded-2xl p-8 flex items-center justify-center gap-3 text-slate-600">
          <Loader size={16} className="animate-spin text-cyan-500/50" />
          <span className="text-[12px]">Loading SRE metrics…</span>
        </div>
      )}

      {/* ── Module Grid ──────────────────────── */}
      <div>
        <h2 className="text-[13px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Quick Navigation</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {modules.map(({ href, icon: Icon, label, desc, accent }) => (
            <Link
              key={href}
              href={href}
              className="group relative glass-card p-4 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{ ['--accent' as string]: accent }}
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
              
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${accent}15`, border: `1px solid ${accent}20` }}
                >
                  <Icon size={15} style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-white font-semibold text-[12px]">{label}</h3>
                    <ArrowUpRight size={10} className="text-slate-600 group-hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100" />
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-slate-700 pb-4 font-medium tracking-wide">🔒 Read-only access · No AWS state is modified</p>
    </div>
  );
}
