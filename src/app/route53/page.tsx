"use client";
import { useEffect, useState } from "react";
import { Radio, Loader, AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface R53HostedZone {
  Id: string;
  Name: string;
  RecordCount: number;
  PrivateZone: boolean;
  Comment: string;
}

export default function Route53Page() {
  const [data, setData] = useState<R53HostedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/route53`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.zones || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const publicZones = data.filter(z => !z.PrivateZone).length;
  const totalRecords = data.reduce((s, z) => s + (z.RecordCount || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Radio size={18} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Route 53 Hosted Zones</h1>
          <p className="text-[11px] text-slate-500">DNS management — global service</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Zones", value: data.length, color: "#3b82f6" },
          { label: "Public Zones", value: publicZones, color: "#06b6d4" },
          { label: "Private Zones", value: data.length - publicZones, color: "#8b5cf6" },
          { label: "Total DNS Records", value: totalRecords, color: "#10b981" },
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
          <span>Loading Route 53 zones…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load Route 53 data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for route53:ListHostedZones</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">No hosted zones found</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Zone Name", "Zone ID", "Records", "Type", "Comment"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((z, i) => (
                <tr key={z.Id} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-4 py-3 font-medium text-white">{z.Name}</td>
                  <td className="px-4 py-3 text-cyan-400 font-mono-brand text-[10px]">{z.Id?.split("/").pop()}</td>
                  <td className="px-4 py-3 text-slate-300">{z.RecordCount}</td>
                  <td className="px-4 py-3">
                    {z.PrivateZone
                      ? <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-bold flex items-center gap-1 w-fit"><XCircle size={9} />Private</span>
                      : <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold flex items-center gap-1 w-fit"><CheckCircle size={9} />Public</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-[11px]">{z.Comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
