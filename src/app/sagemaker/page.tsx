"use client";
import { useEffect, useState } from "react";
import { FlaskConical, Loader, AlertCircle, CheckCircle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

interface SageMakerEndpoint {
  EndpointName: string;
  EndpointStatus: string;
  CreationTime: string;
  LastModifiedTime: string;
  EndpointConfigName?: string;
}

interface SageMakerNotebook {
  NotebookInstanceName: string;
  NotebookInstanceStatus: string;
  InstanceType: string;
  CreationTime: string;
}

export default function SageMakerPage() {
  const { region } = useRegion();
  const [endpoints, setEndpoints] = useState<SageMakerEndpoint[]>([]);
  const [notebooks, setNotebooks] = useState<SageMakerNotebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sagemaker?region=${region}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setEndpoints(d.endpoints || []);
          setNotebooks(d.notebooks || []);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [region]);

  const inService = endpoints.filter(e => e.EndpointStatus === "InService").length;
  const notebookRunning = notebooks.filter(n => n.NotebookInstanceStatus === "InService").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <FlaskConical size={18} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">SageMaker</h1>
          <p className="text-[11px] text-slate-500">ML endpoints & notebooks — region: {region}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Endpoints", value: endpoints.length, color: "#8b5cf6" },
          { label: "In Service", value: inService, color: "#10b981" },
          { label: "Notebook Instances", value: notebooks.length, color: "#06b6d4" },
          { label: "Notebooks Running", value: notebookRunning, color: "#10b981" },
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
          <span>Loading SageMaker resources…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load SageMaker data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for sagemaker:ListEndpoints</p>
          </div>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Endpoints</h2>
            {endpoints.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center text-slate-600">No endpoints in {region}</div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      {["Endpoint Name", "Status", "Config", "Created", "Last Modified"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((e, i) => (
                      <tr key={e.EndpointName} className={`border-b border-white/[0.02] hover:bg-white/[0.02] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                        <td className="px-4 py-3 font-medium text-white text-[11px]">{e.EndpointName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${e.EndpointStatus === "InService" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                            {e.EndpointStatus === "InService" && <CheckCircle size={8} />}
                            {e.EndpointStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[10px] truncate max-w-[200px]">{e.EndpointConfigName || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]">{new Date(e.CreationTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]">{new Date(e.LastModifiedTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Notebook Instances</h2>
            {notebooks.length === 0 ? (
              <div className="glass-card rounded-xl p-6 text-center text-slate-600">No notebook instances in {region}</div>
            ) : (
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      {["Notebook Name", "Status", "Instance Type", "Created"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {notebooks.map((n, i) => (
                      <tr key={n.NotebookInstanceName} className={`border-b border-white/[0.02] hover:bg-white/[0.02] ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                        <td className="px-4 py-3 font-medium text-white text-[11px]">{n.NotebookInstanceName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${n.NotebookInstanceStatus === "InService" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{n.NotebookInstanceStatus}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono-brand text-[10px]">{n.InstanceType}</td>
                        <td className="px-4 py-3 text-slate-500 text-[10px]">{new Date(n.CreationTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
