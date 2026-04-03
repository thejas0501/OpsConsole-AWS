"use client";
import { useEffect, useState } from "react";
import { Cpu, Loader, AlertCircle, CheckCircle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

interface LambdaFn {
  FunctionName: string;
  Runtime: string;
  MemorySize: number;
  Timeout: number;
  LastModified: string;
  CodeSize: number;
  Invocations?: number;
  Errors?: number;
  Duration?: number;
  Throttles?: number;
}

export default function LambdaPage() {
  const { region } = useRegion();
  const [data, setData] = useState<LambdaFn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/lambda?region=${region}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.functions || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [region]);

  const totalFns = data.length;
  const totalInvocations = data.reduce((s, f) => s + (f.Invocations || 0), 0);
  const totalErrors = data.reduce((s, f) => s + (f.Errors || 0), 0);
  const errorRate = totalInvocations > 0 ? ((totalErrors / totalInvocations) * 100).toFixed(2) : "0.00";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Cpu size={18} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Lambda Functions</h1>
          <p className="text-[11px] text-slate-500">Serverless functions — region: {region}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Functions", value: totalFns, color: "#06b6d4" },
          { label: "Total Invocations (15d)", value: totalInvocations.toLocaleString(), color: "#10b981" },
          { label: "Total Errors (15d)", value: totalErrors.toLocaleString(), color: "#f43f5e" },
          { label: "Error Rate", value: `${errorRate}%`, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-bold font-mono-brand" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-slate-500">
          <Loader size={16} className="animate-spin text-cyan-400" />
          <span>Loading Lambda functions…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load Lambda data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for lambda:ListFunctions</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">
          No Lambda functions found in <span className="text-cyan-400 font-mono">{region}</span>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Function Name", "Runtime", "Memory", "Timeout", "Invocations (15d)", "Errors", "Avg Duration", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((fn, i) => {
                const hasErrors = (fn.Errors || 0) > 0;
                return (
                  <tr key={fn.FunctionName} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-4 py-3 font-medium text-white font-mono-brand text-[11px]">{fn.FunctionName}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono-brand text-[10px]">{fn.Runtime || "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{fn.MemorySize} MB</td>
                    <td className="px-4 py-3 text-slate-400">{fn.Timeout}s</td>
                    <td className="px-4 py-3 text-slate-300">{(fn.Invocations || 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 font-semibold ${hasErrors ? "text-red-400" : "text-emerald-400"}`}>{fn.Errors || 0}</td>
                    <td className="px-4 py-3 text-slate-400">{fn.Duration ? `${fn.Duration.toFixed(0)} ms` : "—"}</td>
                    <td className="px-4 py-3">
                      {hasErrors
                        ? <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-bold flex items-center gap-1 w-fit"><AlertCircle size={9} />ERRORS</span>
                        : <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold flex items-center gap-1 w-fit"><CheckCircle size={9} />OK</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
