"use client";
import { useState, useEffect, Fragment } from "react";
import { Server, RefreshCw, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, Activity, HardDrive, Wifi, Cpu } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

/* ── Mini sparkline chart ──────────────────────────────────────────── */
function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <span className="text-[9px] text-slate-600">No data</span>;
  const w = 200;
  const max = Math.max(...data, 0.01);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4)}`).join(" ");
  const area = pts + ` ${w},${height} 0,${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  if (b < 1024) return `${b.toFixed(0)} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

interface LiveMetric {
  name: string;
  unit?: string;
  datapoints: { timestamp: string; value: number }[];
  current: number;
  avg: number;
  max: number;
}

export default function EC2Page() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, LiveMetric[]>>({});
  const [metricsLoading, setMetricsLoading] = useState<Record<string, boolean>>({});

  const { region } = useRegion();

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/ec2?region=${region}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setData(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLiveMetrics({}); setExpandedId(null); fetchData(); }, [region]);

  const fetchLiveMetrics = async (instanceId: string) => {
    if (liveMetrics[instanceId]) return; // already fetched
    setMetricsLoading(prev => ({ ...prev, [instanceId]: true }));
    try {
      const res = await fetch(`/api/live-metrics?instanceId=${instanceId}&type=ec2&hours=6`);
      const d = await res.json();
      if (d.metrics) setLiveMetrics(prev => ({ ...prev, [instanceId]: d.metrics }));
    } catch { }
    finally { setMetricsLoading(prev => ({ ...prev, [instanceId]: false })); }
  };

  const toggleExpand = (instanceId: string) => {
    if (expandedId === instanceId) {
      setExpandedId(null);
    } else {
      setExpandedId(instanceId);
      fetchLiveMetrics(instanceId);
    }
  };

  const instances = data ? (data.instances as Record<string, unknown>[]) : [];
  const summary = data ? (data.summary as Record<string, unknown>) : {};

  const metricColors: Record<string, string> = {
    "CPU Utilization": "#f97316",
    "Network In": "#06b6d4",
    "Network Out": "#8b5cf6",
    "Disk Read Ops": "#3b82f6",
    "Disk Write Ops": "#ec4899",
    "Disk Read Bytes": "#14b8a6",
    "Disk Write Bytes": "#f43f5e",
    "CPU Credit Balance": "#eab308",
    "Status Check Failed": "#ef4444",
  };

  const metricIcons: Record<string, any> = {
    "CPU Utilization": Cpu,
    "Network In": Wifi,
    "Network Out": Wifi,
    "Disk Read Ops": HardDrive,
    "Disk Write Ops": HardDrive,
    "Disk Read Bytes": HardDrive,
    "Disk Write Bytes": HardDrive,
    "CPU Credit Balance": Activity,
    "Status Check Failed": XCircle,
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center">
              <Server size={18} className="text-orange-400" />
            </div>
            EC2 Instances
          </h1>
          <p className="text-[12px] text-slate-500 mt-1.5 ml-[46px]">Click any running instance to view live CPU, disk, and network metrics</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="btn-premium flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-[12px] rounded-xl transition-all font-semibold cursor-pointer shadow-lg shadow-cyan-500/10">
          {loading ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: Number(summary.total || 0), color: "#06b6d4" },
          { label: "Running", value: Number(summary.running || 0), color: "#10b981" },
          { label: "Stopped", value: Number(summary.stopped || 0), color: "#f43f5e" },
          { label: "Other", value: Number(summary.other || 0), color: "#eab308" },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1 font-mono-brand" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-600 flex flex-col items-center gap-3">
          <Loader size={24} className="animate-spin text-cyan-500/50" />
          <span className="text-[12px]">Loading EC2 data…</span>
        </div>
      )}
      {error && <div className="glass-card border-rose-500/20 text-rose-400 rounded-xl p-4 text-[12px] text-center">Error: {error}</div>}

      {!loading && !error && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["", "Name", "Instance ID", "Type", "State", "Public IP", "Private IP", "AZ"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] text-slate-600 font-bold uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instances.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-600 text-[12px]">No EC2 instances found</td></tr>
              )}
              {instances.map((inst) => {
                const id = String(inst.InstanceId || "");
                const isRunning = inst.State === "running";
                const isExpanded = expandedId === id;
                const metrics = liveMetrics[id] || [];
                const isLoadingMetrics = metricsLoading[id] || false;

                return (
                  <Fragment key={id}>
                    <tr
                      key={id}
                      className={`border-b border-white/[0.03] transition-all cursor-pointer hover:bg-white/[0.02] ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                      onClick={() => isRunning && toggleExpand(id)}
                    >
                      <td className="px-4 py-3 w-8">
                        {isRunning && (
                          isExpanded ? <ChevronUp size={14} className="text-cyan-400" /> : <ChevronDown size={14} className="text-slate-600" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white text-[12px]">{String(inst.Name || "-")}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono-brand text-[10px]">{id}</td>
                      <td className="px-4 py-3 text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-slate-400 font-mono-brand text-[10px]">{String(inst.InstanceType || "-")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isRunning ? "text-emerald-400" : inst.State === "stopped" ? "text-rose-400" : "text-amber-400"}`}>
                          {isRunning ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {String(inst.State || "-")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono-brand text-[10px]">{String(inst.PublicIp || "-")}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono-brand text-[10px]">{String(inst.PrivateIp || "-")}</td>
                      <td className="px-4 py-3 text-slate-500 text-[10px]">{String(inst.AZ || "-")}</td>
                    </tr>

                    {/* Expanded Live Metrics */}
                    {isExpanded && (
                      <tr key={`${id}-metrics`}>
                        <td colSpan={8} className="px-4 py-5 bg-white/[0.01]">
                          {isLoadingMetrics && (
                            <div className="flex items-center gap-2 text-slate-600 text-[12px] py-4 justify-center">
                              <Loader size={14} className="animate-spin text-cyan-400" />
                              Fetching CloudWatch metrics for {String(inst.Name || id)}…
                            </div>
                          )}
                          {!isLoadingMetrics && metrics.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {metrics.filter(m => m.datapoints.length > 0).map((m) => {
                                const Icon = metricIcons[m.name] || Activity;
                                const color = metricColors[m.name] || "#06b6d4";
                                const displayVal = m.unit === "bytes" ? formatBytes(m.current) :
                                  m.unit === "%" ? `${m.current.toFixed(1)}%` :
                                  m.current.toFixed(1);
                                const displayAvg = m.unit === "bytes" ? formatBytes(m.avg) :
                                  m.unit === "%" ? `${m.avg.toFixed(1)}%` :
                                  m.avg.toFixed(1);

                                return (
                                  <div key={m.name} className="glass-card rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}15` }}>
                                          <Icon size={11} style={{ color }} />
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-semibold">{m.name}</span>
                                      </div>
                                      <span className="text-[13px] font-bold font-mono-brand text-white">{displayVal}</span>
                                    </div>
                                    <Sparkline data={m.datapoints.map(d => d.value)} color={color} height={35} />
                                    <div className="flex justify-between mt-2 text-[9px] text-slate-600">
                                      <span>Avg: <span className="text-slate-400 font-mono-brand">{displayAvg}</span></span>
                                      <span>Max: <span className="text-slate-400 font-mono-brand">{m.unit === "bytes" ? formatBytes(m.max) : m.unit === "%" ? `${m.max.toFixed(1)}%` : m.max.toFixed(1)}</span></span>
                                      <span className="text-slate-700">Last 6h</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!isLoadingMetrics && metrics.filter(m => m.datapoints.length > 0).length === 0 && (
                            <p className="text-center text-[11px] text-slate-600 py-4">No CloudWatch data available for this instance</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
