"use client";
import { ExternalLink, CheckCircle2, AlertTriangle, AlertCircle, ArrowUpRight } from "lucide-react";
import clsx from "clsx";

export interface ResourceMetric {
  label: string;
  value: number;
  displayValue: string;
  colorClass: string;
}

export interface ResourceCardProps {
  name: string;
  cost: string;
  isExact: boolean;
  provisionStatus: 'Right-sized' | 'Over-provisioned' | 'Under-provisioned';
  healthStatus: 'Healthy' | 'Warning' | 'Critical';
  confidence: string;
  metrics: ResourceMetric[];
  signals: string;
  awsLink?: string;
  dashboardLink?: string;
}

export function ResourceCard({
  name,
  cost,
  isExact,
  provisionStatus,
  healthStatus,
  confidence,
  metrics,
  signals,
  awsLink,
  dashboardLink,
}: ResourceCardProps) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 group hover:shadow-xl hover:shadow-cyan-950/10 transition-all duration-300 hover:-translate-y-0.5">
      
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-white mb-2 group-hover:text-cyan-100 transition-colors">{name}</h3>
          <div className="flex gap-2.5">
            {awsLink && (
              <a href={awsLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] text-cyan-500/70 hover:text-cyan-400 transition-colors font-medium">
                AWS Console <ExternalLink size={8} />
              </a>
            )}
            {dashboardLink && (
              <a href={dashboardLink} className="flex items-center gap-1 text-[9px] text-violet-500/70 hover:text-violet-400 transition-colors font-medium">
                Dashboard <ArrowUpRight size={8} />
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
           <div className="flex items-center gap-1.5">
              {isExact && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-900/20 text-cyan-400 border border-cyan-500/15 text-[8px] font-bold uppercase tracking-wider">
                  Exact
                </span>
              )}
              <span className={clsx(
                "px-2 py-0.5 rounded-md border text-[8px] font-bold uppercase tracking-wider",
                 provisionStatus === 'Over-provisioned' ? "bg-amber-900/15 text-amber-400 border-amber-500/15" : 
                 provisionStatus === 'Right-sized' ? "bg-emerald-900/15 text-emerald-400 border-emerald-500/15" :
                 "bg-rose-900/15 text-rose-400 border-rose-500/15"
              )}>
                 {provisionStatus}
              </span>
           </div>
           <span className={clsx(
              "px-2 py-0.5 rounded-md border flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider",
               healthStatus === 'Healthy' ? "bg-emerald-900/15 text-emerald-400 border-emerald-500/15" : 
               healthStatus === 'Warning' ? "bg-amber-900/15 text-amber-400 border-amber-500/15" : 
               "bg-rose-900/15 text-rose-400 border-rose-500/15"
            )}>
               {healthStatus === 'Healthy' && <CheckCircle2 size={8} />}
               {healthStatus === 'Warning' && <AlertTriangle size={8} />}
               {healthStatus === 'Critical' && <AlertCircle size={8} />}
               {healthStatus}
            </span>
        </div>
      </div>

      {/* Cost */}
      <div className="flex flex-col bg-white/[0.02] rounded-xl p-3.5 border border-white/[0.04]">
         <span className="text-[8px] text-slate-600 font-bold tracking-[0.15em] uppercase mb-1">Cost (14-day period)</span>
         <span className="text-xl font-bold text-white font-mono-brand">USD {cost}</span>
         {confidence && (
            <span className="text-[9px] text-slate-600 mt-1 font-medium">{confidence}</span>
         )}
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-3">
         {metrics.map((m, idx) => (
             <div key={idx} className="flex items-center gap-3">
                 <span className="text-[10px] font-medium text-slate-500 w-24 truncate">{m.label}</span>
                 <div className="flex-1 h-[4px] bg-white/[0.03] rounded-full overflow-hidden">
                     <div 
                        className={clsx("h-full rounded-full transition-all duration-1000 ease-out", m.colorClass)}
                        style={{ width: `${Math.min(Math.max(m.value, 0), 100)}%` }}
                     />
                 </div>
                 <span className="text-[10px] font-mono-brand text-slate-400 w-10 text-right">{m.displayValue}</span>
             </div>
         ))}
      </div>

      {/* Signals */}
      <div className="bg-white/[0.015] rounded-xl p-3 border border-white/[0.03]">
          <span className="text-[9px] text-slate-600 leading-relaxed">
             <strong className="text-slate-500">Signals:</strong> {signals}
          </span>
      </div>
    </div>
  );
}
