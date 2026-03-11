"use client";
import { useState, useEffect } from "react";
import { Clock, RefreshCw, Loader, AlertTriangle, Info, Server, Database, Container, Terminal, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

interface HistoryEvent {
  eventId: string;
  timestamp: string;
  eventName: string;
  resourceId: string;
  resourceType: string;
  username: string;
  sourceIp: string;
  severity: "critical" | "warning" | "info";
  reason: string;
  recoverySteps: string[];
  hasError: boolean;
}

const severityConfig = {
  critical: { icon: ShieldAlert, color: "text-rose-400", border: "border-rose-500/15", badge: "bg-rose-900/15 text-rose-400 border-rose-500/15" },
  warning:  { icon: AlertTriangle, color: "text-amber-400", border: "border-amber-500/15", badge: "bg-amber-900/15 text-amber-400 border-amber-500/15" },
  info:     { icon: Info, color: "text-cyan-400", border: "border-cyan-500/10", badge: "bg-cyan-900/10 text-cyan-400 border-cyan-500/10" },
};

const typeIcon = (type: string) => {
  if (type.includes("Instance")) return Server;
  if (type.includes("DB")) return Database;
  if (type.includes("Cluster") || type.includes("Task")) return Container;
  return Terminal;
};

export default function HistoryPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { region } = useRegion();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/history?region=${region}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const d = await res.json();
      setEvents(d.history || []);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [region]);

  const filtered = events.filter(e => 
    e.resourceId.toLowerCase().includes(search.toLowerCase()) || 
    e.eventName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/15">
              <Clock size={16} className="text-rose-400" />
            </div>
            Failure History
          </h1>
          <p className="text-[12px] text-slate-500 mt-1.5 ml-[42px]">CloudTrail audit — resource downtime in the last 7 days</p>
        </div>
        <div className="flex gap-3 items-center">
            <input 
                type="text" 
                placeholder="Search resource or event…" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.06] text-[12px] text-slate-300 rounded-xl px-4 py-2 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/10 w-64 placeholder:text-slate-600 transition-all"
            />
            <button onClick={fetchData} disabled={loading}
            className="btn-premium flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-[12px] rounded-xl transition-all font-semibold cursor-pointer shadow-lg shadow-cyan-500/10">
            {loading ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {loading ? "Scanning…" : "Refresh"}
            </button>
        </div>
      </div>

      {error && <div className="glass-card border-rose-500/20 text-rose-400 rounded-xl p-4 text-[12px]">Error: {error}</div>}

      <div className="flex flex-col gap-3">
        {loading && (
           <div className="text-center py-24 text-slate-600 flex flex-col items-center gap-3">
               <Loader size={28} className="animate-spin text-cyan-500/50" />
               <span className="text-[12px]">Scanning AWS CloudTrail…</span>
           </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 glass-card rounded-2xl flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <p className="text-emerald-400 font-semibold text-[15px] mt-2">No downtime events detected</p>
            <p className="text-slate-600 text-[11px] max-w-md leading-relaxed">CloudTrail reports zero unexpected stop, terminate, or delete events on your infrastructure in the last 7 days.</p>
          </div>
        )}

        {!loading && filtered.map((ev) => {
          const cfg = severityConfig[ev.severity];
          const SevIcon = cfg.icon;
          const TypeIcon = typeIcon(ev.resourceType);
          const isExpanded = expandedId === ev.eventId;

          return (
            <div key={ev.eventId} className={`glass-card rounded-2xl transition-all duration-300 ${isExpanded ? cfg.border : ""}`}>
              
              {/* Event Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer group"
                onClick={() => setExpandedId(isExpanded ? null : ev.eventId)}
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${cfg.badge}`}>
                    <SevIcon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-[13px] flex items-center gap-2">
                            <TypeIcon size={12} className={cfg.color} />
                            {ev.resourceId}
                        </h3>
                        <span className={`text-[8px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                            {ev.eventName}
                        </span>
                    </div>
                    <div className="flex gap-4 text-[10px] text-slate-600 mt-1 font-medium">
                        <span className="font-mono-brand">{new Date(ev.timestamp).toLocaleString()}</span>
                        <span>User: {ev.username || "AWS System"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-cyan-500/70 group-hover:text-cyan-400 font-medium transition-colors">
                        {isExpanded ? "Collapse" : "Investigate"}
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-5 pb-5 flex flex-col gap-5">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <h4 className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-2">Root Cause</h4>
                            <div className="bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-xl text-[12px] text-slate-400 leading-relaxed">
                                {ev.hasError && <span className="text-rose-400 font-bold mr-1">API Error:</span>}
                                {ev.reason}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-2">Recovery Steps</h4>
                            <div className="bg-emerald-500/[0.03] border border-emerald-500/10 p-3.5 rounded-xl text-[12px]">
                                <ul className="list-disc list-inside text-slate-400 space-y-1.5">
                                    {ev.recoverySteps.map((step, i) => (<li key={i}>{step}</li>))}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 text-[9px] text-slate-700 font-mono-brand border-t border-white/[0.03] pt-3">
                        <span>Event: {ev.eventId?.slice(0, 20)}…</span>
                        <span>IP: {ev.sourceIp}</span>
                        <span>Type: {ev.resourceType}</span>
                    </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
