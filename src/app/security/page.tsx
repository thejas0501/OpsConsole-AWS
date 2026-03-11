"use client";
import { useState, useEffect } from "react";
import { Shield, RefreshCw, Loader, AlertTriangle, CheckCircle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

export default function SecurityPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/security?region=${region}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setData(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Unknown error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [region]);

  const securityGroups = data ? (data.securityGroups as Record<string, unknown>[]) : [];
  const riskyGroups = data ? (data.riskyGroups as Record<string, unknown>[]) : [];
  const vpcs = data ? (data.vpcs as Record<string, unknown>[]) : [];
  const iamSummary = data ? (data.iamSummary as Record<string, unknown>) : {};
  const summary = data ? (data.summary as Record<string, unknown>) : {};

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Shield size={24} className="text-red-400" /> Security Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Security Groups, VPCs, and IAM summary</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Security Groups", value: Number(summary.totalSGs || 0), color: "blue" },
          { label: "Open to 0.0.0.0/0 ⚠️", value: Number(summary.riskySGs || 0), color: "red" },
          { label: "VPCs", value: Number(summary.totalVpcs || 0), color: "purple" },
          { label: "IAM Users", value: Number(iamSummary.Users || 0), color: "yellow" },
        ].map((s) => (
          <div key={s.label} className="bg-[#111827] border border-[#1F2937] p-4 rounded-lg">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 text-${s.color}-400`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-400"><Loader className="animate-spin" size={16} /> Loading security data...</div>}
      {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg p-4 text-sm">Error: {error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risky Security Groups */}
          <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-3">
            <h3 className="font-bold text-white flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /> Risky Security Groups (Open to Internet)</h3>
            {riskyGroups.length === 0 && <p className="text-green-400 text-sm flex items-center gap-1"><CheckCircle size={14} /> No security groups open to 0.0.0.0/0</p>}
            {(riskyGroups as Record<string, unknown>[]).map((sg, i) => (
              <div key={i} className="bg-red-900/10 border border-red-800/30 p-3 rounded text-xs">
                <div className="flex justify-between">
                  <span className="font-semibold text-white">{String(sg.GroupName)}</span>
                  <span className="text-red-400 font-mono">{String(sg.GroupId)}</span>
                </div>
                <p className="text-slate-400 mt-1">Open Ports: <span className="text-red-400">{(sg.OpenPorts as unknown[]).join(", ") || "All"}</span></p>
              </div>
            ))}
          </div>

          {/* VPCs */}
          <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-3">
            <h3 className="font-bold text-white">VPCs</h3>
            {vpcs.map((v, i) => (
              <div key={i} className="bg-slate-800/30 border border-slate-700 p-3 rounded text-xs flex justify-between items-center">
                <div>
                  <span className="font-semibold text-white">{String(v.Name)}</span>
                  <span className="ml-2 text-slate-400 font-mono">{String(v.CidrBlock)}</span>
                </div>
                <div className="flex gap-2">
                  {!!v.IsDefault && <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full">Default</span>}
                  <span className={`px-2 py-0.5 rounded-full ${v.State === "available" ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>{String(v.State)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* IAM Summary */}
          <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg">
            <h3 className="font-bold text-white mb-4">IAM Account Summary</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Users", value: iamSummary.Users },
                { label: "Groups", value: iamSummary.Groups },
                { label: "Roles", value: iamSummary.Roles },
                { label: "Policies", value: iamSummary.Policies },
                { label: "MFA Devices", value: iamSummary.MFADevices },
                { label: "Account MFA", value: iamSummary.AccountMFAEnabled ? "✅ On" : "❌ Off" },
              ].map((item, i) => (
                <div key={i} className="bg-slate-800/30 rounded p-3 text-center">
                  <p className="text-lg font-bold text-white">{item.value != null ? String(item.value) : "-"}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* All Security Groups */}
          <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-2">
            <h3 className="font-bold text-white mb-2">All Security Groups ({securityGroups.length})</h3>
            <div className="overflow-y-auto max-h-64 flex flex-col gap-2">
              {securityGroups.map((sg, i) => (
                <div key={i} className={`p-3 rounded text-xs border ${!!sg.OpenToInternet ? "border-red-800/30 bg-red-900/10" : "border-slate-700 bg-slate-800/30"}`}>
                  <div className="flex justify-between">
                    <span className="font-semibold text-white">{String(sg.GroupName)}</span>
                  <span className={`font-mono ${sg.OpenToInternet ? "text-red-400" : "text-slate-400"}`}>{String(sg.GroupId)}</span>
                  </div>
                  <p className="text-slate-500 mt-0.5">{String(sg.Description)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
