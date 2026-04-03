"use client";
import { useState, useEffect } from "react";
import { Trash2, HardDrive, Network, Layers, Server, RefreshCw, Loader, DollarSign, AlertTriangle } from "lucide-react";
import { useRegion } from "@/components/RegionProvider";

/* ── Types ──────────────────────────────────────────────────────────── */
interface EbsVolume { VolumeId: string; Size: number; VolumeType: string; CreateTime: string; Name?: string; }
interface Eip { PublicIp: string; AllocationId: string; }
interface TgEntry { TgName: string; LbName: string; }
interface IdleEc2 { InstanceId: string; Name: string; InstanceType: string; CpuAvg7d: number; }

/* ── Saving estimate card ───────────────────────────────────────────── */
function SavingsCard({ icon: Icon, label, count, saving, color, unit }: {
  icon: React.ElementType; label: string; count: number; saving: number; color: string; unit?: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center"
        style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-white font-mono-brand">{count} {unit}</p>
      </div>
      {saving > 0 && (
        <div className="text-right shrink-0">
          <p className="text-[8px] text-slate-600 uppercase tracking-wider">Est. Monthly Save</p>
          <p className="text-base font-bold font-mono-brand text-emerald-400">${saving.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}

/* ── Empty State ────────────────────────────────────────────────────── */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-slate-600 text-[12px]">
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mx-auto mb-2">
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      {message}
    </div>
  );
}

/* ── Section ────────────────────────────────────────────────────────── */
function Section({ icon: Icon, title, count, color, children }: {
  icon: React.ElementType; title: string; count: number; color: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-3">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}14` }}>
          <Icon size={12} style={{ color }} />
        </div>
        <h3 className="text-white font-semibold text-[13px] flex-1">{title}</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
          style={{ background: `${color}12`, color, borderColor: `${color}25` }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */
export default function WasteDashboard() {
  const { region } = useRegion();
  const [data, setData] = useState<{
    unattachedEbs: EbsVolume[];
    unusedEips: Eip[];
    zeroHealthyTg: TgEntry[];
    idleEc2: IdleEc2[];
  }>({ unattachedEbs: [], unusedEips: [], zeroHealthyTg: [], idleEc2: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true); setError(null);
    fetch(`/api/waste?cpu=5.0&region=${region}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch Waste analysis data");
        return res.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { fetchData(); }, [region]);

  // Calculate estimated monthly savings
  const ebsMonthlySave = data.unattachedEbs.reduce((s, v) => s + (v.Size || 0) * 0.10, 0);
  const eipMonthlySave = data.unusedEips.length * 3.65;
  const ec2MonthlySave = data.idleEc2.length * 20; // rough estimate
  const totalWaste = ebsMonthlySave + eipMonthlySave + ec2MonthlySave;

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-slate-300">

      {/* Header */}
      <div className="flex items-center justify-between glass-card p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
            <Trash2 size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Waste & Idle Resources</h2>
            <p className="text-[11px] text-slate-600">Identify unattached and underutilized infrastructure · {region}</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-amber-500/25 text-[11px] text-slate-400 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Savings summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SavingsCard icon={HardDrive} label="Unattached EBS" count={data.unattachedEbs.length} saving={ebsMonthlySave} color="#f97316" unit="volumes" />
        <SavingsCard icon={Network} label="Unused Elastic IPs" count={data.unusedEips.length} saving={eipMonthlySave} color="#8b5cf6" unit="IPs" />
        <SavingsCard icon={Server} label="Idle EC2 (< 5% CPU)" count={data.idleEc2.length} saving={ec2MonthlySave} color="#06b6d4" unit="instances" />
        <SavingsCard icon={Layers} label="Zero-Healthy TGs" count={data.zeroHealthyTg.length} saving={0} color="#ef4444" unit="groups" />
      </div>

      {/* Total waste callout */}
      {!loading && totalWaste > 0 && (
        <div className="glass-card rounded-2xl p-5 flex items-center gap-4 border border-amber-500/15">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <DollarSign size={20} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-400 font-bold text-[13px]">Estimated Monthly Waste</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Based on EBS gp2 ($0.10/GB), Elastic IP ($3.65/mo), and EC2 idle cost ($20/instance/mo).
              Actual costs may vary.
            </p>
          </div>
          <p className="text-3xl font-bold text-amber-400 font-mono-brand shrink-0">${totalWaste.toFixed(2)}<span className="text-[11px] text-slate-500 ml-1">/mo</span></p>
        </div>
      )}

      {loading && (
        <div className="text-center py-16 flex flex-col items-center gap-3 text-slate-600">
          <Loader size={22} className="animate-spin text-amber-500/50" />
          <span className="text-[12px]">Scanning AWS account for waste… (may take a moment)</span>
        </div>
      )}
      {error && (
        <div className="glass-card border-rose-500/20 text-rose-400 rounded-xl p-4 text-[12px] flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Unattached EBS */}
          <Section icon={HardDrive} title="Unattached EBS Volumes" count={data.unattachedEbs.length} color="#f97316">
            {data.unattachedEbs.length === 0 ? (
              <EmptyState message="No unattached EBS volumes found." />
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-80 overflow-y-auto">
                {data.unattachedEbs.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      {v.Name && <p className="text-[12px] text-white font-semibold">{v.Name}</p>}
                      <p className="text-[10px] text-slate-500 font-mono">{v.VolumeId}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {v.VolumeType?.toUpperCase()} · {v.Size} GB · Created {new Date(v.CreateTime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-orange-400 font-bold font-mono-brand">${(v.Size * 0.10).toFixed(2)}/mo</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Unused EIPs */}
          <Section icon={Network} title="Unused Elastic IPs" count={data.unusedEips.length} color="#8b5cf6">
            {data.unusedEips.length === 0 ? (
              <EmptyState message="No unused Elastic IPs found." />
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-80 overflow-y-auto">
                {data.unusedEips.map((eip, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white font-semibold font-mono-brand">{eip.PublicIp}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{eip.AllocationId}</p>
                    </div>
                    <p className="text-[10px] text-violet-400 font-bold font-mono-brand shrink-0">$3.65/mo</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Idle EC2 */}
          <Section icon={Server} title="Idle EC2 Instances (< 5% CPU, 7 days)" count={data.idleEc2.length} color="#06b6d4">
            {data.idleEc2.length === 0 ? (
              <EmptyState message="No idle EC2 instances found." />
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-80 overflow-y-auto">
                {data.idleEc2.map((ec2, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white font-semibold">{ec2.Name !== ec2.InstanceId ? ec2.Name : "—"}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{ec2.InstanceId} · {ec2.InstanceType}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-cyan-400 font-mono-brand font-bold">{Number(ec2.CpuAvg7d).toFixed(1)}% CPU</p>
                        <p className="text-[9px] text-slate-600">7-day avg</p>
                      </div>
                      <div className="w-16 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500/50 rounded-full" style={{ width: `${Math.min((ec2.CpuAvg7d / 5) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Zero-Healthy Target Groups */}
          <Section icon={Layers} title="Zero-Healthy Target Groups" count={data.zeroHealthyTg.length} color="#ef4444">
            {data.zeroHealthyTg.length === 0 ? (
              <EmptyState message="No empty or unhealthy target groups found." />
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-80 overflow-y-auto">
                {data.zeroHealthyTg.map((tg, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white font-semibold">{tg.TgName}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">via ALB: <span className="text-slate-400">{tg.LbName}</span></p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">0 Healthy</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

        </div>
      )}
    </div>
  );
}
