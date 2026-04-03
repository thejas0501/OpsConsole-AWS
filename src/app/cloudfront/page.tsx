"use client";
import { useEffect, useState } from "react";
import { Wifi, Loader, AlertCircle, Globe } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

interface CFDistribution {
  Id: string;
  DomainName: string;
  Status: string;
  PriceClass: string;
  Origins: string[];
  Aliases: string[];
  HttpVersion: string;
  Enabled: boolean;
  Requests?: number;
  BytesDownloaded?: number;
  CacheHitRate?: number;
}

function fmtBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function CloudFrontPage() {
  const { region } = useRegion();
  const [data, setData] = useState<CFDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cloudfront?region=${region}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.distributions || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [region]);

  const deployed = data.filter(d => d.Status === "Deployed").length;
  const enabled = data.filter(d => d.Enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Wifi size={18} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">CloudFront Distributions</h1>
          <p className="text-[11px] text-slate-500">CDN distributions — global service (region selector ignored)</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Distributions", value: data.length, color: "#06b6d4" },
          { label: "Deployed", value: deployed, color: "#10b981" },
          { label: "Enabled", value: enabled, color: "#3b82f6" },
          { label: "Disabled", value: data.length - enabled, color: "#64748b" },
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
          <span>Loading CloudFront distributions…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load CloudFront data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for cloudfront:ListDistributions</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">
          <Globe size={32} className="mx-auto mb-3 text-slate-700" />
          No CloudFront distributions found in this account
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Distribution ID", "Domain", "Aliases", "Status", "Price Class", "HTTP", "Enabled"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.Id} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-4 py-3 font-mono-brand text-[10px] text-cyan-400">{d.Id}</td>
                  <td className="px-4 py-3 text-slate-400 text-[10px] max-w-[180px] truncate">{d.DomainName}</td>
                  <td className="px-4 py-3 text-slate-400 text-[10px]">{d.Aliases?.join(", ") || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.Status === "Deployed" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{d.Status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-[10px]">{d.PriceClass?.replace("PriceClass_", "PC") || "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{d.HttpVersion || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${d.Enabled ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-500"}`}>{d.Enabled ? "Yes" : "No"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
