"use client";
import { useEffect, useState } from "react";
import { HardDrive, Loader, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";

interface Pipeline {
  Name: string;
  RoleArn: string;
  Created: string;
  Updated: string;
  Status?: string;
  ExecutionId?: string;
  LastExecutionStatus?: string;
  LastExecutionTime?: string;
  LastExecutionRevision?: string;
}

const STATUS_COLORS: Record<string, string> = {
  Succeeded: "text-emerald-400 bg-emerald-500/10",
  Failed: "text-red-400 bg-red-500/10",
  InProgress: "text-blue-400 bg-blue-500/10",
  Stopped: "text-slate-400 bg-slate-500/10",
  Superseded: "text-amber-400 bg-amber-500/10",
};

export default function CodePipelinePage() {
  const [data, setData] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/codepipeline`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.pipelines || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const succeeded = data.filter(p => p.LastExecutionStatus === "Succeeded").length;
  const failed = data.filter(p => p.LastExecutionStatus === "Failed").length;
  const inProgress = data.filter(p => p.LastExecutionStatus === "InProgress").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <HardDrive size={18} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">CodePipeline</h1>
          <p className="text-[11px] text-slate-500">CI/CD pipelines — most recent execution status</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Pipelines", value: data.length, color: "#6366f1" },
          { label: "Last Run: Succeeded", value: succeeded, color: "#10b981" },
          { label: "Last Run: Failed", value: failed, color: "#f43f5e" },
          { label: "In Progress", value: inProgress, color: "#3b82f6" },
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
          <span>Loading pipelines…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load CodePipeline data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for codepipeline:ListPipelines</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">No CodePipelines found</div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map(p => {
            const sc = STATUS_COLORS[p.LastExecutionStatus || ""] || "text-slate-400 bg-slate-500/10";
            return (
              <div key={p.Name} className="glass-card rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    {p.LastExecutionStatus === "Succeeded" ? <CheckCircle size={15} className="text-emerald-400" />
                      : p.LastExecutionStatus === "Failed" ? <XCircle size={15} className="text-red-400" />
                      : <HardDrive size={15} className="text-indigo-400" />}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{p.Name}</p>
                    {p.LastExecutionTime && (
                      <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                        <Clock size={8} /> Last run: {new Date(p.LastExecutionTime).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
                {p.LastExecutionStatus && (
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${sc}`}>{p.LastExecutionStatus}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
