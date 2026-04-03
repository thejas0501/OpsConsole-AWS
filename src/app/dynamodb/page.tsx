"use client";
import { useEffect, useState } from "react";
import { Layers, Loader, AlertCircle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

interface DynamoTable {
  TableName: string;
  Status: string;
  ItemCount: number;
  SizeBytes: number;
  BillingMode: string;
  ReadCapacity?: number;
  WriteCapacity?: number;
  Replicas?: number;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function DynamoDBPage() {
  const { region } = useRegion();
  const [data, setData] = useState<DynamoTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dynamodb?region=${region}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.tables || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [region]);

  const totalSize = data.reduce((s, t) => s + (t.SizeBytes || 0), 0);
  const totalItems = data.reduce((s, t) => s + (t.ItemCount || 0), 0);
  const onDemand = data.filter(t => t.BillingMode === "PAY_PER_REQUEST").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Layers size={18} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">DynamoDB Tables</h1>
          <p className="text-[11px] text-slate-500">NoSQL tables — region: {region}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Tables", value: data.length, color: "#8b5cf6" },
          { label: "Total Items", value: totalItems.toLocaleString(), color: "#06b6d4" },
          { label: "Total Data Size", value: fmtBytes(totalSize), color: "#10b981" },
          { label: "On-Demand Tables", value: onDemand, color: "#f59e0b" },
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
          <span>Loading DynamoDB tables…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load DynamoDB data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for dynamodb:ListTables</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">
          No DynamoDB tables found in <span className="text-cyan-400 font-mono">{region}</span>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Table Name", "Status", "Item Count", "Size", "Billing Mode", "Read Cap", "Write Cap"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((t, i) => (
                <tr key={t.TableName} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-4 py-3 font-medium text-white font-mono-brand text-[11px]">{t.TableName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.Status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{t.Status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{(t.ItemCount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtBytes(t.SizeBytes || 0)}</td>
                  <td className="px-4 py-3 text-slate-400 text-[10px]">{t.BillingMode === "PAY_PER_REQUEST" ? "On-Demand" : "Provisioned"}</td>
                  <td className="px-4 py-3 text-slate-500">{t.ReadCapacity ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{t.WriteCapacity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
