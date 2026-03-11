"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Database, 
  Container, 
  Box, 
  ArrowRightLeft,
  DollarSign,
  Cpu,
  Shield,
  Map,
  TrendingDown,
  Bell,
  LogOut
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Cost Monitoring', href: '/cost', icon: DollarSign },
  { name: 'ECS Clusters', href: '/ecs', icon: Container },
  { name: 'RDS Databases', href: '/rds', icon: Database },
  { name: 'ElastiCache', href: '/elasticache', icon: Cpu },
  { name: 'Security Flow', href: '/security', icon: Shield },
  { name: 'Load Balancers', href: '/alb', icon: ArrowRightLeft },
  { name: 'S3 Storage', href: '/s3', icon: Box },
  { name: 'Infrastructure Map', href: '/infra', icon: Map },
  { name: 'Optimization', href: '/optimization', icon: TrendingDown },
  { name: 'Alerts', href: '/alerts', icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#0B1120] border-r border-[#1E293B] text-slate-300 flex flex-col h-screen fixed">
      {/* Brand area */}
      <div className="p-6 flex flex-col gap-1 border-b border-[#1E293B]/50">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 tracking-widest uppercase mb-2">
            <span className="grid place-items-center w-5 h-5 bg-blue-600 rounded-sm text-white">#</span>
            Observability
        </div>
        <h1 className="text-xl font-bold text-white tracking-wide">
          AWS Ops Console
        </h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium",
                isActive 
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/20" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <Icon size={18} className={clsx(isActive ? "text-blue-400" : "text-slate-500")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-[#1E293B]">
         <button className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors w-full">
            <LogOut size={16} />
            Logout
         </button>
      </div>
    </aside>
  );
}
