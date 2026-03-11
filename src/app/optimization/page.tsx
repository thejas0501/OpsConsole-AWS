"use client";
import { useState, useEffect } from "react";
import { TrendingDown, RefreshCw, Loader, AlertTriangle, Info, CheckCircle, DollarSign } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

interface Finding {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  resource: string;
  resourceType: string;
  finding: string;
  suggestion: string;
  estimatedMonthlySavings?: number;
  data?: Record<string, unknown>;
}

interface Summary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  estimatedMonthlySavings: number;
  estimatedAnnualSavings: number;
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-900/20", border: "border-red-800/40", badge: "bg-red-900/40 text-red-400 border-red-700/50" },
  warning:  { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-800/40", badge: "bg-amber-900/40 text-amber-400 border-amber-700/50" },
  info:     { icon: Info, color: "text-blue-400", bg: "bg-blue-900/10", border: "border-blue-800/30", badge: "bg-blue-900/30 text-blue-400 border-blue-700/50" },
};

const categoryColors: Record<string, string> = {
  EC2: "text-orange-400", EBS: "text-red-400", Networking: "text-purple-400",
  RDS: "text-blue-400", ECS: "text-violet-400", S3: "text-yellow-400",
  ALB: "text-teal-400", ElastiCache: "text-rose-400",
};

export default function OptimizationPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const { region } = useRegion();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/optimization?region=${region}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const d = await res.json();
      setFindings(d.findings);
      setSummary(d.summary);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  };

  const filtered = filter === "all" ? findings : findings.filter(f => f.severity === filter);

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingDown size={22} className="text-emerald-400" /> Optimization Report
          </h1>
          <p className="text-sm text-slate-500 mt-1">Read-only analysis of your AWS resources — cost savings & right-sizing recommendations</p>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium">
          {loading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {loading ? "Scanning AWS…" : "Scan & Generate Report"}
        </button>
      </div>

      {/* Empty state */}
      {!loading && !summary && !error && (
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-16 text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingDown size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">Ready to Scan</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-md">Click "Scan & Generate Report" to read your AWS resources and get a comprehensive optimisation report with cost-saving opportunities.</p>
          </div>
          <div className="flex gap-4 text-xs text-slate-600 mt-2">
            <span>✓ EC2 instances</span><span>✓ RDS databases</span><span>✓ EBS volumes</span>
            <span>✓ Elastic IPs</span><span>✓ ECS services</span><span>✓ S3 buckets</span><span>✓ ALB targets</span>
          </div>
        </div>
      )}

      {error && <div className="bg-red-900/20 border border-red-700/50 text-red-400 rounded-xl p-4 text-sm">Error: {error}</div>}

      {/* Summary cards */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total Findings", value: summary.total, color: "text-white" },
              { label: "Critical", value: summary.critical, color: "text-red-400" },
              { label: "Warning", value: summary.warning, color: "text-amber-400" },
              { label: "Info", value: summary.info, color: "text-blue-400" },
              { label: "Monthly Savings", value: `$${summary.estimatedMonthlySavings}`, color: "text-emerald-400" },
              { label: "Annual Savings", value: `$${summary.estimatedAnnualSavings}`, color: "text-emerald-300" },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] p-4 rounded-xl text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Savings banner */}
          {summary.estimatedMonthlySavings > 0 && (
            <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/20 border border-emerald-700/30 rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                <DollarSign size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold">Estimated Savings: <span className="text-emerald-400">${summary.estimatedMonthlySavings}/month · ${summary.estimatedAnnualSavings}/year</span></p>
                <p className="text-slate-400 text-xs mt-0.5">Based on AWS pricing estimates. Actual savings may vary. All recommendations are read-only suggestions only.</p>
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {(["all", "critical", "warning", "info"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${filter === f ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {f} {f !== "all" && `(${summary[f as keyof Summary] || 0})`}
              </button>
            ))}
          </div>

          {/* Findings */}
          <div className="flex flex-col gap-3">
            {filtered.length === 0 && (
              <div className="text-center py-10">
                <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-emerald-400 font-medium">No {filter === "all" ? "" : filter} findings!</p>
                <p className="text-slate-500 text-sm mt-1">Your resources look well-optimised in this category.</p>
              </div>
            )}
            {filtered.map((f) => {
              const cfg = severityConfig[f.severity];
              const SevIcon = cfg.icon;
              return (
                <div key={f.id} className={`rounded-xl border p-5 ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <SevIcon size={16} className={`${cfg.color} mt-0.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-white font-semibold text-sm">{f.resource}</span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cfg.badge}`}>{f.severity}</span>
                          <span className={`text-[10px] font-medium ${categoryColors[f.category] || "text-slate-400"}`}>{f.resourceType}</span>
                        </div>
                        <p className="text-slate-300 text-xs leading-relaxed mb-2">{f.finding}</p>
                        <div className="bg-black/20 border border-white/[0.05] rounded-lg p-3">
                          <p className="text-[11px] text-slate-400"><span className="text-emerald-400 font-medium">Suggestion: </span>{f.suggestion}</p>
                        </div>
                        {f.data && (
                          <div className="flex gap-3 mt-2 flex-wrap">
                            {Object.entries(f.data).map(([k, v]) => (
                              <span key={k} className="text-[10px] text-slate-500 bg-white/[0.03] rounded px-2 py-0.5">
                                {k}: <span className="text-slate-300">{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {f.estimatedMonthlySavings && f.estimatedMonthlySavings > 0 && (
                      <div className="shrink-0 text-right">
                        <p className="text-emerald-400 font-bold text-sm">${f.estimatedMonthlySavings}</p>
                        <p className="text-[10px] text-slate-500">/month</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
