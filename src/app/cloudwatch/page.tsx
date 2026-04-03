"use client";
import { useEffect, useState } from "react";
import { BarChart2, Loader, AlertCircle } from "lucide-react";

interface CWAlarm {
  AlarmName: string;
  AlarmDescription?: string;
  StateValue: string;
  Namespace: string;
  MetricName: string;
  ComparisonOperator: string;
  Threshold: number;
  Period: number;
  EvaluationPeriods: number;
  StateUpdatedTimestamp: string;
}

const STATE_COLOR: Record<string, string> = {
  ALARM: "text-red-400 bg-red-500/10 border-red-500/20",
  OK: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  INSUFFICIENT_DATA: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

export default function CloudWatchPage() {
  const [data, setData] = useState<CWAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cloudwatch`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(Array.isArray(d) ? d : d.alarms || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const alarmCount = data.filter(a => a.StateValue === "ALARM").length;
  const okCount = data.filter(a => a.StateValue === "OK").length;
  const insufficientCount = data.filter(a => a.StateValue === "INSUFFICIENT_DATA").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <BarChart2 size={18} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">CloudWatch Alarms</h1>
          <p className="text-[11px] text-slate-500">Monitoring alarms — all states</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Alarms", value: data.length, color: "#06b6d4" },
          { label: "In ALARM", value: alarmCount, color: "#f43f5e" },
          { label: "OK", value: okCount, color: "#10b981" },
          { label: "Insufficient Data", value: insufficientCount, color: "#64748b" },
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
          <span>Loading CloudWatch alarms…</span>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-6 flex items-center gap-3 text-amber-400">
          <AlertCircle size={16} />
          <div>
            <p className="font-semibold text-sm">Could not load CloudWatch data</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{error} — check IAM permissions for cloudwatch:DescribeAlarms</p>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-600">No CloudWatch alarms configured</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {["Alarm Name", "State", "Namespace", "Metric", "Threshold", "Last Updated"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sort((a, b) => (a.StateValue === "ALARM" ? -1 : 1)).map((alarm, i) => {
                const sc = STATE_COLOR[alarm.StateValue] || STATE_COLOR.INSUFFICIENT_DATA;
                return (
                  <tr key={alarm.AlarmName} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-4 py-3 font-medium text-white text-[11px]">{alarm.AlarmName}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc}`}>{alarm.StateValue}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[10px]">{alarm.Namespace}</td>
                    <td className="px-4 py-3 text-slate-400 text-[10px]">{alarm.MetricName}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono-brand text-[10px]">{alarm.Threshold}</td>
                    <td className="px-4 py-3 text-slate-500 text-[10px]">
                      {alarm.StateUpdatedTimestamp ? new Date(alarm.StateUpdatedTimestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } as Intl.DateTimeFormatOptions) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
