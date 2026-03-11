"use client";
import { ChevronDown, RefreshCw, Bell } from "lucide-react";
import clsx from "clsx";

export default function Header() {
  return (
    <header className="h-[88px] border-b border-[#1E293B] bg-[#0F172A] flex flex-col justify-center px-6 sticky top-0 z-10 w-full shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        
        {/* Left Side: Region */}
        <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Region</label>
            <div className="flex items-center gap-2 bg-[#1E293B] border border-slate-700 rounded text-sm px-3 py-1.5 text-white w-40 cursor-pointer hover:bg-slate-800 transition-colors">
                <span>ap-south-1</span>
                <ChevronDown size={14} className="ml-auto text-slate-400" />
            </div>
        </div>

        {/* Center: Date Ranges */}
        <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                <div className="flex items-center gap-2 bg-[#1E293B] border border-slate-700 rounded text-sm px-3 py-1.5 text-white min-w-[140px]">
                    <span className="tabular-nums">03/04/2026</span>
                    <ChevronDown size={14} className="ml-auto text-slate-400" />
                </div>
            </div>
            
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</label>
                <div className="flex items-center gap-2 bg-[#1E293B] border border-slate-700 rounded text-sm px-3 py-1.5 text-white min-w-[140px]">
                    <span className="tabular-nums text-blue-400">03/10/2026</span>
                    <ChevronDown size={14} className="ml-auto text-slate-400" />
                </div>
            </div>

            <div className="flex flex-col gap-1 ml-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Exact Billing</label>
                <div className="flex items-center gap-2 bg-[#1E293B] border border-blue-500/30 rounded text-sm px-3 py-1.5 text-blue-300 min-w-[180px] cursor-pointer hover:bg-slate-800">
                    <span>On (CUR + Athena)</span>
                    <ChevronDown size={14} className="ml-auto text-blue-400" />
                </div>
            </div>
            
             <div className="flex flex-col gap-1 ml-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Range</label>
                <div className="flex items-center bg-[#1E293B] border border-slate-700 rounded p-0.5">
                    {['1D','1W','2W','3W','1M'].map((range) => (
                        <button 
                            key={range}
                            className={clsx(
                                "text-xs font-semibold px-3 py-1.5 rounded-sm transition-colors",
                                range === '1W' ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                            )}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-3 mt-4 lg:mt-0">
             <button className="flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-slate-800 border border-slate-700 rounded text-xs font-semibold px-4 py-2 text-slate-300 transition-colors">
                <RefreshCw size={14} />
                Hard Refresh <br/><span className="text-[10px] text-slate-500">(CUR)</span>
             </button>
             
             <button className="flex flex-col items-center justify-center gap-0.5 bg-[#1E293B] border border-orange-500/30 rounded px-4 py-1.5 transition-colors group hover:bg-slate-800">
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-300 group-hover:text-white">
                    <Bell size={12} className="text-orange-400" /> Alerts
                </span>
                <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 rounded-sm">12</span>
             </button>
             
             <div className="flex flex-col items-end justify-center ml-2 border-l border-slate-700 pl-4">
                 <span className="text-[10px] text-slate-500 whitespace-nowrap">Last refresh</span>
                 <span className="text-xs font-mono text-slate-300 whitespace-nowrap">13:08:37 PM</span>
             </div>
        </div>
        
      </div>
    </header>
  );
}
