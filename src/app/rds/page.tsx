"use client";
import { useEffect, useState } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { Database, Loader } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

export default function RDSDashboard() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const { region } = useRegion();
  const [costData, setCostData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 14 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    Promise.all([
      fetch(`/api/rds?region=${region}`).then(res => res.ok ? res.json() : []),
      fetch(`/api/cost?start=${fmt(start)}&end=${fmt(end)}`).then(res => res.ok ? res.json() : {})
    ])
      .then(([rdsRes, costRes]: [any, any]) => {
         const rdsInstances = Array.isArray(rdsRes) ? rdsRes : [];
         setData(rdsInstances);
         const rdsMap: Record<string, number> = {};

         // Try resource-level RDS cost first
         if (costRes.rdsBreakdown && costRes.rdsBreakdown.length > 0) {
           for (const item of costRes.rdsBreakdown) {
             const parts = (item.id as string).split(':');
             const lastPart = parts[parts.length - 1];
             const dbPart = parts.length >= 7 ? parts[6] : lastPart;
             rdsMap[dbPart] = (rdsMap[dbPart] || 0) + item.amount;
             rdsMap[lastPart] = (rdsMap[lastPart] || 0) + item.amount;
             rdsMap[item.id] = item.amount;
           }
         }

         // Fallback: Use service-level RDS cost and weight by instance class
         if (Object.keys(rdsMap).length === 0 && costRes.services && rdsInstances.length > 0) {
           let rdsTotalCost = 0;
           for (const s of costRes.services) {
             if ((s.service as string)?.includes("Relational Database")) {
               rdsTotalCost += s.amount;
             }
           }
           if (rdsTotalCost > 0) {
             // Weight cost by instance CPU usage (more active = more cost)
             const cpuValues = rdsInstances.map((db: any) => Math.max(Number(db.CpuAvg) || 1, 1));
             const totalCpu = cpuValues.reduce((a: number, b: number) => a + b, 0);
             rdsInstances.forEach((db: any, i: number) => {
               const weight = cpuValues[i] / totalCpu;
               rdsMap[String(db.Identifier)] = rdsTotalCost * weight;
             });
           }
         }

         setCostData(rdsMap);
         setLoading(false);
      })
      .catch(e => {
         setError(e.message);
         setLoading(false);
      });
  }, [region]);

  // Compute total cost
  const uniqueCosts = new Map<string, number>();
  for (const db of data) {
    const id = String(db.Identifier);
    if (costData[id]) uniqueCosts.set(id, costData[id]);
  }
  const totalRdsCost = [...uniqueCosts.values()].reduce((s, v) => s + v, 0);
  const totalCostDisplay = totalRdsCost > 0 ? totalRdsCost.toFixed(2) : "—";

  // Stats
  const over = data.filter(d => !d.IsRisky).length;
  const rightSized = data.filter(d => d.IsRisky).length;



  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">
      
      {/* Header */}
      <div className="flex items-center justify-between glass-card p-5 py-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/15 flex items-center justify-center">
            <Database size={18} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              RDS Databases
              <span className="px-2 py-0.5 rounded-md bg-cyan-900/15 text-cyan-400 border border-cyan-500/15 text-[8px] font-bold uppercase tracking-[0.15em]">
                Cost Explorer
              </span>
            </h2>
            <p className="text-[11px] text-slate-600 font-medium">{data.length} instances monitored</p>
          </div>
        </div>

        <div className="flex gap-5 items-center">
            <div className="flex gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-amber-900/15 text-amber-400 border border-amber-500/15 text-[8px] font-bold uppercase tracking-wider">Over: {over}</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-900/15 text-emerald-400 border border-emerald-500/15 text-[8px] font-bold uppercase tracking-wider">Right: {rightSized}</span>
            </div>

            <div className="h-8 w-px bg-white/[0.04]" />

            <div className="flex flex-col items-end">
                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.15em] mb-0.5">Total (14 days)</span>
                <span className="text-lg font-bold text-white bg-white/[0.03] px-3 py-1 rounded-xl border border-white/[0.06] font-mono-brand">
                    USD {totalCostDisplay}
                </span>
            </div>
        </div>
      </div>

       {loading && (
         <div className="text-center py-16 text-slate-600 flex flex-col items-center gap-3">
           <Loader size={24} className="animate-spin text-cyan-500/50" />
           <span className="text-[12px]">Scanning AWS environment…</span>
         </div>
       )}
       {error && <div className="glass-card border-rose-500/20 text-rose-400 rounded-xl p-4 text-[12px] text-center">Error: {error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {!loading && !error && data.map(db => {
             const storagePct = db.AllocatedStorageGB ? 
                Math.max(0, 100 - ( (Number(db.FreeStorageBytesMin) / (Number(db.AllocatedStorageGB) * 1024 * 1024 * 1024)) * 100 )) 
                : 0;
             const dbId = String(db.Identifier);
             const dbCost = costData[dbId] ? costData[dbId].toFixed(2) : "0.00";

             return (
                 <ResourceCard 
                    key={dbId}
                    name={dbId}
                    cost={dbCost}
                    isExact={false}
                    provisionStatus={db.IsRisky ? "Right-sized" : "Over-provisioned"} 
                    healthStatus={db.Status === 'available' ? 'Healthy' : 'Warning'}
                    confidence="Weighted from Cost Explorer service data"
                    awsLink={`https://${region}.console.aws.amazon.com/rds/home?region=${region}#database:id=${dbId}`}
                    dashboardLink="/rds"
                    signals={`CPU avg 24h ${Number(db.CpuAvg).toFixed(1)}% | Storage used ${storagePct.toFixed(1)}% | Conns ${db.ConnectionsMax}`}
                    metrics={[
                        { label: "CPU", value: Number(db.CpuAvg), displayValue: `${Number(db.CpuAvg).toFixed(1)}%`, colorClass: Number(db.CpuAvg) > 80 ? "bg-red-500" : Number(db.CpuAvg) > 50 ? "bg-amber-500" : "bg-blue-500" },
                        { label: "Storage Usage", value: storagePct, displayValue: `${storagePct.toFixed(1)}%`, colorClass: storagePct > 90 ? "bg-red-500" : storagePct > 70 ? "bg-amber-500" : "bg-blue-500" },
                        { label: "Connections", value: Math.min(Number(db.ConnectionsMax), 100), displayValue: String(db.ConnectionsMax), colorClass: "bg-blue-500" }
                    ]}
                 />
             );
          })}
          {!loading && !error && data.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-12">No RDS instances found in the current region.</div>
          )}
      </div>
    </div>
  );
}
