"use client";
import { useState, useEffect } from "react";
import { Box, Lock, FileArchive, Tag } from "lucide-react";
import clsx from "clsx";
import { ExportCSVButton } from "@/components/ExportCSVButton";
import { useRegion } from "@/components/RegionProvider";

export default function S3Dashboard() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const { region } = useRegion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/s3?region=${region}`)
      .then(res => {
         if(!res.ok) throw new Error("Failed to fetch S3 data");
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

  const formatBytes = (bytes: number) => {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-[#111827] border border-[#1F2937] p-5 py-4 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-900/20 text-yellow-400 rounded-md">
            <Box size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              S3 Storage
            </h2>
            <p className="text-xs text-slate-400">Bucket inventory, metrics, and posture</p>
          </div>
        </div>
        {!loading && data.length > 0 && <ExportCSVButton data={data} filename="s3-inventory" />}
      </div>

       {loading && <div className="text-center py-12 text-slate-500 animate-pulse">Scanning S3 Buckets...</div>}
       {error && <div className="p-4 bg-red-900/30 border border-red-500/30 text-red-400 rounded text-sm text-center">Error: {error}</div>}

      {!loading && !error && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-lg overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-[#1E293B] text-slate-400 text-xs uppercase tracking-wider border-b border-[#1F2937]">
                    <th className="p-4 font-semibold">Bucket Name</th>
                    <th className="p-4 font-semibold">Region</th>
                    <th className="p-4 font-semibold">Size</th>
                    <th className="p-4 font-semibold">Objects</th>
                    <th className="p-4 font-semibold">Security / Posture</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937]">
                  {data.map((b, i) => (
                     <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                         <td className="p-4 text-sm font-medium text-white break-all">{String(b.Name)}</td>
                         <td className="p-4 text-sm text-slate-400">{String(b.Region)}</td>
                         <td className="p-4 text-sm font-mono text-blue-400">{formatBytes(Number(b.SizeBytes))}</td>
                         <td className="p-4 text-sm font-mono text-slate-300">{(Number(b.NumObjects) || 0).toLocaleString()}</td>
                         <td className="p-4">
                             <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                                 <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded border border-opacity-30", b.Encryption === "Enabled" ? "bg-green-900/20 text-green-500 border-green-500" : "bg-red-900/20 text-red-500 border-red-500")}>
                                     <Lock size={10} /> {b.Encryption === "Enabled" ? "Encrypted" : "Unencrypted"}
                                 </span>
                                 
                                 <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded border border-opacity-30", b.Versioning === "Enabled" ? "bg-blue-900/20 text-blue-500 border-blue-500" : "bg-slate-800 text-slate-400 border-slate-600")}>
                                     <FileArchive size={10} /> Ver: {String(b.Versioning).substring(0,6)}
                                 </span>
  
                                 <span className={clsx("flex items-center gap-1 px-2 py-0.5 rounded border border-opacity-30", b.Lifecycle === "Configured" ? "bg-purple-900/20 text-purple-400 border-purple-500" : "bg-slate-800 text-slate-400 border-slate-600")}>
                                     <Tag size={10} /> Life: {String(b.Lifecycle).substring(0,4)}
                                 </span>
                             </div>
                         </td>
                     </tr>
                  ))}
                  {data.length === 0 && (
                      <tr className="hover:bg-slate-800/50 transition-colors text-center">
                           <td colSpan={5} className="p-4 text-sm text-slate-400 self-center items-center">No S3 Buckets found.</td>
                      </tr>
                  )}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}
