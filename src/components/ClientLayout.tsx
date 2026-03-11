"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { LayoutDashboard, DollarSign, Database, Container, Server, ArrowRightLeft, Box, Zap, Shield, Trash2, Network, TrendingDown, Clock, ChevronRight, ChevronDown, Globe } from "lucide-react";
import { RegionProvider, useRegion } from "@/components/RegionProvider";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview", group: "main" },
  { href: "/infrastructure", icon: Network, label: "Infrastructure Map", group: "main" },
  { href: "/optimization", icon: TrendingDown, label: "Optimization", group: "main" },
  { href: "/history", icon: Clock, label: "Failure History", group: "main" },
  { href: "/cost", icon: DollarSign, label: "Cost Monitoring", group: "resources" },
  { href: "/rds", icon: Database, label: "RDS Databases", group: "resources" },
  { href: "/ecs", icon: Container, label: "ECS Clusters", group: "resources" },
  { href: "/ec2", icon: Server, label: "EC2 Instances", group: "resources" },
  { href: "/alb", icon: ArrowRightLeft, label: "Load Balancers", group: "resources" },
  { href: "/s3", icon: Box, label: "S3 Storage", group: "resources" },
  { href: "/elasticache", icon: Zap, label: "ElastiCache", group: "resources" },
  { href: "/security", icon: Shield, label: "Security", group: "security" },
  { href: "/waste", icon: Trash2, label: "Waste", group: "security" },
];

/* ── Region Selector ─────────────────────────────────────────────── */
function RegionSelector() {
  const { region, setRegion, regions, regionLabel } = useRegion();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = regions.filter(r => r.label.toLowerCase().includes(search.toLowerCase()) || r.value.includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all text-[11px] cursor-pointer"
      >
        <Globe size={12} className="text-cyan-400" />
        <span className="text-slate-400 font-medium">{region}</span>
        <ChevronDown size={11} className={`text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-[#0a0f1a] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="p-2 border-b border-white/[0.04]">
            <input
              type="text"
              placeholder="Search region…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500/30 placeholder:text-slate-600"
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map(r => (
              <button
                key={r.value}
                onClick={() => { setRegion(r.value); setOpen(false); setSearch(""); }}
                className={`w-full text-left px-3 py-2 text-[11px] flex items-center justify-between hover:bg-cyan-500/[0.06] transition-colors cursor-pointer ${r.value === region ? "bg-cyan-500/[0.08] text-cyan-400" : "text-slate-400"}`}
              >
                <span className="font-medium">{r.label}</span>
                <span className="text-[9px] text-slate-600 font-mono">{r.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Nav Link ────────────────────────────────────────────────────── */
function NavLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} className={`group relative flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[12.5px] font-medium transition-all duration-200 ${isActive ? "bg-gradient-to-r from-cyan-500/[0.12] to-transparent text-white" : "text-slate-500 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/[0.08] hover:to-transparent"}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? "bg-cyan-500/15" : "bg-white/[0.03] group-hover:bg-cyan-500/10"}`}>
        <Icon size={13} className={`shrink-0 transition-colors duration-200 ${isActive ? "text-cyan-400" : "group-hover:text-cyan-400"}`} />
      </div>
      <span className="flex-1">{label}</span>
      {isActive && <div className="w-1 h-4 rounded-full bg-cyan-400 absolute left-0" />}
      <ChevronRight size={12} className={`transition-all duration-200 ${isActive ? "opacity-50 text-cyan-400" : "opacity-0 group-hover:opacity-50 -translate-x-1 group-hover:translate-x-0"}`} />
    </Link>
  );
}

/* ── Client Layout ───────────────────────────────────────────────── */
export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RegionProvider>
      <LayoutInner>{children}</LayoutInner>
    </RegionProvider>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { region } = useRegion();

  return (
    <>
      {/* ── Sidebar ─────────────────────────── */}
      <aside className="w-[250px] shrink-0 flex flex-col border-r border-white/[0.04] bg-[#030711]/95 backdrop-blur-2xl">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-cyan-500/20 animate-gradient">
              <LayoutDashboard size={18} className="text-white drop-shadow" />
            </div>
            <div>
              <p className="text-white font-semibold text-[14px] leading-none tracking-tight">OpsConsole</p>
              <p className="text-[10px] text-cyan-400/60 mt-1 font-medium tracking-wide">CLOUD · AWS</p>
            </div>
          </div>
        </div>

        {/* Region Selector */}
        <div className="px-3 py-3 border-b border-white/[0.04]">
          <RegionSelector />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-4 flex flex-col gap-0.5 overflow-y-auto">
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600 px-3 mb-2">Dashboard</p>
          {navItems.filter(n => n.group === "main").map(n => <NavLink key={n.href} {...n} />)}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent my-3" />
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600 px-3 mb-2">Resources</p>
          {navItems.filter(n => n.group === "resources").map(n => <NavLink key={n.href} {...n} />)}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent my-3" />
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600 px-3 mb-2">Operations</p>
          {navItems.filter(n => n.group === "security").map(n => <NavLink key={n.href} {...n} />)}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[10px] text-emerald-400/80 font-medium">Read-only · {region}</span>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-[52px] shrink-0 border-b border-white/[0.04] bg-[#030711]/80 backdrop-blur-2xl flex items-center px-6 justify-between">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
            <p className="text-[13px] text-slate-400 font-medium">AWS Cloud Observability</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-400 tracking-widest uppercase">Live</span>
            </div>
            <span className="text-[11px] text-slate-600 font-mono-brand">
              {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}
