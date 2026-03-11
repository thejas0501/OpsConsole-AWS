"use client";
import { useState, useEffect } from "react";
import { Container, Activity, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { ExportCSVButton } from "@/components/ExportCSVButton";
import { useRegion } from "@/components/RegionProvider";

export default function ECSDashboard() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ecs?region=${region}`)
      .then(res => {
         if(!res.ok) throw new Error("Failed to fetch ECS data");
         return res.json();
      })
      .then(d => {
         setData(d);
         setLoading(false);
      })
      .catch(e => {
         setError(e.message);
         setLoading(false);
      });
  }, [region]);

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-[#111827] border border-[#1F2937] p-5 py-4 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900/20 text-purple-400 rounded-md">
            <Container size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ECS Clusters
            </h2>
            <p className="text-xs text-slate-400">Fargate capacity & deployment health</p>
          </div>
        </div>
        {!loading && data.length > 0 && <ExportCSVButton data={data} filename="ecs-health" />}
      </div>

      {loading && <div className="text-center py-12 text-slate-500 animate-pulse">Scanning ECS clusters...</div>}
      {error && <div className="p-4 bg-red-900/30 border border-red-500/30 text-red-400 rounded text-sm text-center">Error: {error} (Check AWS credentials)</div>}

      {/* Table grid */}
      {!loading && !error && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-lg overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-[#1E293B] text-slate-400 text-xs uppercase tracking-wider border-b border-[#1F2937]">
                    <th className="p-4 font-semibold">Cluster</th>
                    <th className="p-4 font-semibold">Service</th>
                    <th className="p-4 font-semibold">Tasks (R/D/P)</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Health</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                  {data.map((svc: Record<string, unknown>, i: number) => (
                      <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 text-sm font-medium text-white">{String(svc.Cluster)}</td>
                          <td className="p-4 text-sm text-slate-300">{String(svc.Service)}</td>
                          <td className="p-4 text-sm font-mono text-slate-400">
                             <span className={clsx(Number(svc.Running) < Number(svc.Desired) ? "text-red-400" : "text-green-400")}>{Number(svc.Running)}</span>
                             <span> / {Number(svc.Desired)} / </span>
                             <span className={Number(svc.Pending) > 0 ? "text-yellow-400" : ""}>{Number(svc.Pending)}</span>
                          </td>
                          <td className="p-4 text-sm">
                              <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs">
                                  {String(svc.Status)}
                              </span>
                          </td>
                          <td className="p-4 text-sm">
                              {svc.Unhealthy ? (
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded w-fit border border-red-500/20">
                                      <AlertTriangle size={14} /> Failed / Scaling
                                  </span>
                              ) : (
                                  <span className="flex items-center gap-1.5 text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded w-fit border border-green-500/20">
                                      <Activity size={14} /> Healthy
                                  </span>
                              )}
                          </td>
                      </tr>
                  ))}
                  {data.length === 0 && (
                      <tr className="hover:bg-slate-800/50 transition-colors text-center w-full">
                           <td colSpan={5} className="p-4 text-sm text-slate-400 mx-auto justify-center self-center w-[100%] items-center text-center">No clusters/services found.</td>
                      </tr>
                  )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}
