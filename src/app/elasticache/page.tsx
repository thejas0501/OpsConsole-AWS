"use client";
import { useState, useEffect } from "react";
import { Zap, RefreshCw, Loader, CheckCircle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

export default function ElastiCachePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/elasticache?region=${region}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setData(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [region]);

  const clusters = data ? (data.clusters as Record<string, unknown>[]) : [];
  const summary = data ? (data.summary as Record<string, unknown>) : {};

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Zap size={24} className="text-yellow-400" /> ElastiCache</h1>
          <p className="text-sm text-slate-400 mt-1">Redis and Memcached clusters — status, engine version, node type</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Clusters", value: Number(summary.total || 0), color: "blue" },
          { label: "Available", value: Number(summary.available || 0), color: "green" },
          { label: "Redis", value: Number(summary.redis || 0), color: "red" },
          { label: "Memcached", value: Number(summary.memcached || 0), color: "yellow" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111827] border border-[#1F2937] p-4 rounded-lg">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 text-${s.color}-400`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-400"><Loader className="animate-spin" size={16} /> Loading ElastiCache data...</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg p-4 text-sm">Error: {error} (Ensure AWS credentials are in .env.local)</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clusters.length === 0 && <p className="text-slate-500 col-span-3">No ElastiCache clusters found.</p>}
          {clusters.map((c, i) => (
            <div key={i} className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{String(c.ClusterId)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.Status === "available" ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>
                  {c.Status === "available" ? <CheckCircle size={10} className="inline mr-1" /> : null}{String(c.Status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div><span className="text-slate-500">Engine:</span> <span className="text-white">{String(c.Engine)} {String(c.EngineVersion)}</span></div>
                <div><span className="text-slate-500">Node Type:</span> <span className="text-white">{String(c.NodeType)}</span></div>
                <div><span className="text-slate-500">Nodes:</span> <span className="text-white">{String(c.NumNodes)}</span></div>
                {c.Port != null && <div><span className="text-slate-500">Port:</span> <span className="text-white">{String(c.Port)}</span></div>}
                {!!c.Endpoint && <div className="col-span-2"><span className="text-slate-500">Endpoint:</span> <span className="text-white font-mono text-[10px]">{String(c.Endpoint)}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
