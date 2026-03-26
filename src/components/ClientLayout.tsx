"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard, DollarSign, Database, Container, Server,
  ArrowRightLeft, Box, Zap, Shield, Trash2, Network, TrendingDown,
  Clock, ChevronRight, ChevronDown, Globe, Lock, Eye, EyeOff,
  Loader2, LogOut, GitBranch, Cpu, Radio, HardDrive, Layers,
  Wifi, BarChart2, FlaskConical,
} from "lucide-react";
import { RegionProvider, useRegion } from "@/components/RegionProvider";

const navItems = [
  // ── Dashboard ──────────────────────────────────────
  { href: "/",               icon: LayoutDashboard, label: "Overview",          group: "main" },
  { href: "/infrastructure", icon: Network,          label: "Infrastructure Map",group: "main" },
  { href: "/optimization",   icon: TrendingDown,     label: "Optimization",      group: "main" },
  { href: "/history",        icon: Clock,            label: "Failure History",   group: "main" },
  // ── Compute & Containers ───────────────────────────
  { href: "/ec2",            icon: Server,           label: "EC2 Instances",     group: "compute" },
  { href: "/ecs",            icon: Container,        label: "ECS Clusters",      group: "compute" },
  { href: "/elasticache",    icon: Zap,              label: "ElastiCache",       group: "compute" },
  { href: "/lambda",         icon: Cpu,              label: "Lambda Functions",  group: "compute" },
  // ── Storage & Data ─────────────────────────────────
  { href: "/rds",            icon: Database,         label: "RDS Databases",     group: "data" },
  { href: "/s3",             icon: Box,              label: "S3 Storage",        group: "data" },
  { href: "/dynamodb",       icon: Layers,           label: "DynamoDB",          group: "data" },
  // ── Networking ─────────────────────────────────────
  { href: "/alb",            icon: ArrowRightLeft,   label: "Load Balancers",    group: "networking" },
  { href: "/cloudfront",     icon: Wifi,             label: "CloudFront",        group: "networking" },
  { href: "/route53",        icon: Radio,            label: "Route 53",          group: "networking" },
  // ── Developer Services ─────────────────────────────
  { href: "/amplify",        icon: GitBranch,        label: "Amplify",           group: "devtools" },
  { href: "/codepipeline",   icon: HardDrive,        label: "CodePipeline",      group: "devtools" },
  // ── Monitoring & Cost ──────────────────────────────
  { href: "/cost",           icon: DollarSign,       label: "Cost Monitoring",   group: "ops" },
  { href: "/cloudwatch",     icon: BarChart2,        label: "CloudWatch",        group: "ops" },
  // ── Security & Operations ──────────────────────────
  { href: "/security",       icon: Shield,           label: "Security",          group: "ops" },
  { href: "/waste",          icon: Trash2,           label: "Waste",             group: "ops" },
  { href: "/sagemaker",      icon: FlaskConical,     label: "SageMaker",         group: "ops" },
];

const navGroups: { key: string; label: string }[] = [
  { key: "main",       label: "Dashboard" },
  { key: "compute",    label: "Compute" },
  { key: "data",       label: "Storage & Data" },
  { key: "networking", label: "Networking" },
  { key: "devtools",   label: "Developer Tools" },
  { key: "ops",        label: "Operations" },
];

/* ── Region Selector ─────────────────────────────────────────────── */
function RegionSelector() {
  const { region, setRegion, regions } = useRegion();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = regions.filter(
    r => r.label.toLowerCase().includes(search.toLowerCase()) || r.value.includes(search.toLowerCase())
  );

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
        <div className="absolute top-full mt-2 left-0 w-72 bg-[#0a0f1a] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 z-[200] overflow-hidden">
          <div className="p-2 border-b border-white/[0.04]">
            <input
              type="text"
              placeholder="Search region…"
              value={search}
              onChange={e => setSearch(e.target.value)}
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
function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[12.5px] font-medium transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-r from-cyan-500/[0.12] to-transparent text-white"
          : "text-slate-500 hover:text-white hover:bg-gradient-to-r hover:from-cyan-500/[0.08] hover:to-transparent"
      }`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 ${isActive ? "bg-cyan-500/15" : "bg-white/[0.03] group-hover:bg-cyan-500/10"}`}>
        <Icon size={13} className={`shrink-0 transition-colors duration-200 ${isActive ? "text-cyan-400" : "group-hover:text-cyan-400"}`} />
      </div>
      <span className="flex-1 truncate">{label}</span>
      {isActive && <div className="w-1 h-4 rounded-full bg-cyan-400 absolute left-0" />}
      <ChevronRight size={12} className={`transition-all duration-200 shrink-0 ${isActive ? "opacity-50 text-cyan-400" : "opacity-0 group-hover:opacity-50 -translate-x-1 group-hover:translate-x-0"}`} />
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

/* ── Auth Overlay ────────────────────────────────────────────────── */
function AuthOverlay({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
      });
      const data = await res.json();
      if (data.success) {
        onAuthenticated();
      } else {
        setError(data.message || "Invalid password");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#030711] flex items-center justify-center p-6">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="relative w-full max-w-[400px] bg-[#0a0f1a] border border-white/[0.08] rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20 mb-6 scale-110">
            <Lock size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">OpsConsole Access</h2>
          <p className="text-slate-400 text-sm">Enter password to access the dashboard</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 ml-1">Password</label>
            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                className={`w-full bg-white/[0.03] border ${error ? "border-red-500/50" : "border-white/[0.06]"} group-hover:border-cyan-500/30 focus:border-cyan-500/50 text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-slate-700`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-cyan-400 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p className="text-[11px] text-red-400 mt-2 ml-1 flex items-center gap-1.5 font-medium">
                <span className="w-1 h-1 rounded-full bg-red-400" />
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Access Dashboard"}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Cloud · SRE · Operations</p>
        </div>
      </div>
    </div>
  );
}

/* ── Layout Inner ────────────────────────────────────────────────── */
function LayoutInner({ children }: { children: React.ReactNode }) {
  const { region } = useRegion();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/status", { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setIsAuthenticated(!!d.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  if (isAuthenticated === null) return null;
  if (!isAuthenticated) return <AuthOverlay onAuthenticated={() => setIsAuthenticated(true)} />;

  return (
    <>
      {/* ── Sidebar — FIXED so it never scrolls with the page ─────── */}
      <aside className="fixed top-0 left-0 h-screen w-[250px] flex flex-col border-r border-white/[0.04] bg-[#030711]/98 backdrop-blur-2xl z-50">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/[0.04] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-600 flex items-center justify-center shadow-xl shadow-cyan-500/20">
              <LayoutDashboard size={18} className="text-white drop-shadow" />
            </div>
            <div>
              <p className="text-white font-semibold text-[14px] leading-none tracking-tight">OpsConsole</p>
              <p className="text-[10px] text-cyan-400/60 mt-1 font-medium tracking-wide">CLOUD · AWS</p>
            </div>
          </div>
        </div>

        {/* Region Selector */}
        <div className="px-3 py-3 border-b border-white/[0.04] shrink-0">
          <RegionSelector />
        </div>

        {/* Navigation — scrollable independently */}
        <nav className="flex-1 px-2.5 py-4 flex flex-col gap-0.5 overflow-y-auto min-h-0">
          {navGroups.map((group, gi) => {
            const items = navItems.filter(n => n.group === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                {gi > 0 && <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent my-2" />}
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600 px-3 mb-1.5">{group.label}</p>
                {items.map(n => <NavLink key={n.href} {...n} />)}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/[0.04] space-y-2 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[10px] text-emerald-400/80 font-medium">Read-only · {region}</span>
          </div>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
              window.location.reload();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] text-slate-600 hover:text-rose-400 hover:bg-rose-500/[0.06] transition-all cursor-pointer"
          >
            <LogOut size={11} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main — offset by sidebar width, fills full height ────── */}
      <div className="ml-[250px] flex flex-col h-screen w-[calc(100vw-250px)]">
        {/* Top bar */}
        <header className="h-[52px] shrink-0 border-b border-white/[0.04] bg-[#030711]/80 backdrop-blur-2xl flex items-center px-6 justify-between sticky top-0 z-40">
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

        {/* Content — this is the ONLY scroll area */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}
