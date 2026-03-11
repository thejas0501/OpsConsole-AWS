"use client";
import { useState, useEffect } from "react";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";
import clsx from "clsx";
import { ExportCSVButton } from "@/components/ExportCSVButton";
import { useRegion } from "@/components/RegionProvider";

export default function ALBDashboard() {
  const [data, setData] = useState<{ albs: Record<string, unknown>[], targetGroups: Record<string, unknown>[] }>({ albs: [], targetGroups: [] });
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/alb?region=${region}`)
      .then(res => {
         if(!res.ok) throw new Error("Failed to fetch ALB data");
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
          <div className="p-2 bg-teal-900/20 text-teal-400 rounded-md">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Load Balancers & Target Groups
            </h2>
            <p className="text-xs text-slate-400">Traffic routing health & 5XX metrics</p>
          </div>
        </div>
        {!loading && <div className="flex gap-2">
            <ExportCSVButton data={data.albs} filename="alb-metrics" />
            <ExportCSVButton data={data.targetGroups} filename="target-groups" />
        </div>}
      </div>

       {loading && <div className="text-center py-12 text-slate-500 animate-pulse">Scanning Load Balancers...</div>}
       {error && <div className="p-4 bg-red-900/30 border border-red-500/30 text-red-400 rounded text-sm text-center">Error: {error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-6">

            {/* Application Load Balancers (5XX Errors) */}
             <div className="bg-[#111827] border border-[#1F2937] rounded-lg p-5">
                 <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-[#1F2937] pb-2">Active ALBs</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                     {data.albs.map((alb: Record<string, unknown>, i: number) => (
                         <div key={i} className="flex border border-slate-800 bg-slate-900/50 rounded-lg p-4 justify-between items-center group hover:bg-slate-800 transition-colors">
                             <div className="flex flex-col px-2">
                                 <span className="text-sm font-bold text-white">{String(alb.Name)}</span>
                                 <span className="text-[10px] text-slate-400">Scheme: {String(alb.Scheme)} | State: {String(alb.State)}</span>
                             </div>
                             <div className="flex gap-4">
                                 <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-slate-500 uppercase font-semibold">5XX (1h)</span>
                                      <span className={clsx("text-lg font-mono font-bold", Number(alb.error5XX_1h) > 0 ? "text-red-400" : "text-slate-300")}>{Number(alb.error5XX_1h)}</span>
                                 </div>
                                  <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-slate-500 uppercase font-semibold">5XX (24h)</span>
                                      <span className={clsx("text-lg font-mono font-bold", Number(alb.error5XX_24h) > 10 ? "text-red-400" : "text-slate-300")}>{Number(alb.error5XX_24h)}</span>
                                 </div>
                             </div>
                         </div>
                     ))}
                     {data.albs.length === 0 && <div className="text-sm text-slate-500">No ALBs found in region.</div>}
                 </div>
             </div>


            {/* Target Groups */}
            <div className="bg-[#111827] border border-[#1F2937] rounded-lg overflow-hidden">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-[#1E293B] text-slate-400 text-xs uppercase tracking-wider border-b border-[#1F2937]">
                      <th className="p-4 font-semibold">Load Balancer</th>
                      <th className="p-4 font-semibold">Target Group</th>
                      <th className="p-4 font-semibold">Healthy</th>
                      <th className="p-4 font-semibold">Unhealthy</th>
                      <th className="p-4 font-semibold">Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937]">
                    {data.targetGroups.map((tg: Record<string, unknown>, i: number) => {
                        return (
                            <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-4 text-sm font-medium text-white">{String(tg.AlbName)}</td>
                                <td className="p-4 text-sm text-slate-300">{String(tg.TgName)}</td>
                                <td className="p-4 text-sm font-mono text-green-400">{Number(tg.Healthy)}</td>
                                <td className={clsx("p-4 text-sm font-mono", Number(tg.Unhealthy) > 0 ? "text-red-400" : "text-slate-400")}>{Number(tg.Unhealthy)}</td>
                                <td className="p-4 text-sm">
                                    {tg.ZeroHealthy ? (
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-900/30 px-2 py-1 rounded w-fit border border-red-500/20">
                                            <ShieldAlert size={12} /> 0 Healthy Targets
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-1 rounded w-fit border border-slate-700">
                                            Routing
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                     {data.targetGroups.length === 0 && (
                        <tr className="hover:bg-slate-800/50 transition-colors text-center">
                             <td colSpan={5} className="p-4 text-sm text-slate-400 self-center items-center">No Target Groups found.</td>
                        </tr>
                    )}
                </tbody>
             </table>
            </div>
        </div>
      )}
    </div>
  );
}
