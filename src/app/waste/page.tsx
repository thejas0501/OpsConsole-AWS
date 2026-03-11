"use client";
import { useState, useEffect } from "react";
import { Trash2, HardDrive, Network, Layers, Server } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

export default function WasteDashboard() {
  const [data, setData] = useState<Record<string, unknown>>({ unattachedEbs: [], unusedEips: [], zeroHealthyTg: [], idleEc2: [] });
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/waste?cpu=5.0&region=${region}`) // 5% CPU threshold over 7 days
      .then(res => {
         if(!res.ok) throw new Error("Failed to fetch Waste analysis data");
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
          <div className="p-2 bg-pink-900/20 text-pink-400 rounded-md">
            <Trash2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Waste / Idle Resources
            </h2>
            <p className="text-xs text-slate-400">Identify unattached and underutilized infrastructure</p>
          </div>
        </div>
      </div>

       {loading && <div className="text-center py-12 text-slate-500 animate-pulse">Scanning AWS account for waste... (This can take a moment depending on the number of resources)</div>}
       {error && <div className="p-4 bg-red-900/30 border border-red-500/30 text-red-400 rounded text-sm text-center">Error: {error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Unattached EBS */}
            <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <HardDrive size={16} className="text-slate-400" /> Unattached EBS Volumes
                    <span className="ml-auto bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{(data.unattachedEbs as Record<string, unknown>[])?.length || 0}</span>
                </h3>
                {(data.unattachedEbs as Record<string, unknown>[])?.map((v: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex flex-col bg-slate-800/30 p-3 border border-slate-700 rounded gap-1">
                        <span className="text-xs font-mono text-white">{String(v.VolumeId)}</span>
                        <span className="text-[10px] text-slate-400">Size: {String(v.Size)} GB | Type: {String(v.VolumeType)} | Created: {new Date(String(v.CreateTime)).toLocaleDateString()}</span>
                    </div>
                ))}
                {(!data.unattachedEbs || (data.unattachedEbs as Record<string, unknown>[]).length === 0) && <span className="text-xs text-slate-500">No unattached EBS volumes found.</span>}
            </div>

            {/* Unused EIPs */}
            <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Network size={16} className="text-slate-400" /> Unused Elastic IPs
                    <span className="ml-auto bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{(data.unusedEips as Record<string, unknown>[])?.length || 0}</span>
                </h3>
                 {(data.unusedEips as Record<string, unknown>[])?.map((eip: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex flex-col bg-slate-800/30 p-3 border border-slate-700 rounded gap-1">
                        <span className="text-xs font-mono text-white">{String(eip.PublicIp)}</span>
                        <span className="text-[10px] text-slate-400">Alloc ID: {String(eip.AllocationId)}</span>
                    </div>
                ))}
                {(!data.unusedEips || (data.unusedEips as Record<string, unknown>[]).length === 0) && <span className="text-xs text-slate-500">No unused Elastic IPs found.</span>}
            </div>

            {/* Zero Healthy TGs */}
            <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Layers size={16} className="text-slate-400" /> Zero-Healthy Target Groups
                    <span className="ml-auto bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{(data.zeroHealthyTg as Record<string, unknown>[])?.length || 0}</span>
                </h3>
                 {(data.zeroHealthyTg as Record<string, unknown>[])?.map((tg: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex flex-col bg-slate-800/30 p-3 border border-slate-700 rounded gap-1">
                        <span className="text-xs font-medium text-white">{String(tg.TgName)}</span>
                        <span className="text-[10px] text-slate-400">ALB: {String(tg.LbName)}</span>
                    </div>
                ))}
                {(!data.zeroHealthyTg || (data.zeroHealthyTg as Record<string, unknown>[]).length === 0) && <span className="text-xs text-slate-500">No empty/unhealthy target groups found.</span>}
            </div>

            {/* Idle EC2 */}
            <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-lg flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Server size={16} className="text-slate-400" /> Idle EC2 Instances (&lt; 5% CPU 7d)
                    <span className="ml-auto bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-[10px]">{(data.idleEc2 as Record<string, unknown>[])?.length || 0}</span>
                </h3>
                 {(data.idleEc2 as Record<string, unknown>[])?.map((ec2: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex flex-col bg-slate-800/30 p-3 border border-slate-700 rounded gap-1 relative">
                        <span className="text-xs font-medium text-white">{String(ec2.Name)}</span>
                        <span className="text-[10px] text-slate-400">ID: {String(ec2.InstanceId)} | Type: {String(ec2.InstanceType)}</span>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-900/30 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono">
                            {Number(ec2.CpuAvg7d).toFixed(1)}% CPU
                        </div>
                    </div>
                ))}
                {(!data.idleEc2 || (data.idleEc2 as Record<string, unknown>[]).length === 0) && <span className="text-xs text-slate-500">No idle EC2 instances found.</span>}
            </div>

        </div>
      )}
    </div>
  );
}
