"use client";
import { useEffect, useState } from "react";
import { GitBranch, Loader, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface AmplifyApp {
  AppId: string;
  Name: string;
  DefaultDomain: string;
  Repository: string;
  Platform: string;
  CreateTime: string;
  UpdateTime: string;
  ProductionBranch?: string;
  Status?: string;
}

export default function AmplifyPage() {
  const [data, setData] = useState<AmplifyApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/amplify`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.apps || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
          <GitBranch size={18} className="text-pink-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AWS Amplify</h1>
          <p className="text-[11px] text-slate-500">Full-stack web & mobile apps</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Apps", value: data.length, color: "#ec4899" },
          { label: "Web Apps", value: data.filter(a => a.Platform === "WEB" || a.Platform === "WEB_COMPUTE").length, color: "#06b6d4" },
          { label: "Mobile Apps", value: data.filter(a => a.Platform === "MOB").length, color: "#8b5cf6" },
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
          <span>Loading Amplify apps…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load Amplify data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for amplify:ListApps</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">
          No Amplify apps found in this account
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map(app => (
            <div key={app.AppId} className="glass-card rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                  <GitBranch size={16} className="text-pink-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm">{app.Name}</p>
                  <p className="text-[10px] text-cyan-400 font-mono-brand truncate">{app.DefaultDomain}</p>
                  {app.Repository && <p className="text-[10px] text-slate-600 truncate mt-0.5">{app.Repository}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="px-2 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 text-[10px] font-bold">{app.Platform || "WEB"}</span>
                {app.ProductionBranch && (
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] flex items-center gap-1">
                    <CheckCircle size={9} /> {app.ProductionBranch}
                  </span>
                )}
                <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-500 text-[10px] flex items-center gap-1">
                  <Clock size={9} /> {new Date(app.UpdateTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
