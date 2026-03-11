"use client";
import { Download } from "lucide-react";
import Papa from "papaparse";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
}

export function ExportCSVButton({ data, filename }: ExportButtonProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
        onClick={handleExport}
        disabled={!data || data.length === 0}
        className="flex items-center gap-2 bg-[#1E293B] hover:bg-slate-800 border border-slate-700 rounded text-xs px-3 py-1.5 text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <Download size={14} /> Export CSV
    </button>
  );
}
