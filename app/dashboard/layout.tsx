'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Bot,
  PlusCircle,
  Server,
  Wallet,
  ShoppingBag,
  FileText,
  LayoutDashboard,
  LogOut,
  UserCheck,
  Lock,
  Loader2,
  Cpu
} from 'lucide-react';
import { ConnectButton } from '@/components/wallet/ConnectButton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3 font-mono">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Authenticating session security...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  const navItems = [
    { name: 'My Agents', href: '/dashboard', icon: Bot },
    { name: 'Deploy Workspace', href: '/dashboard/deploy', icon: PlusCircle },
    { name: 'My Workspaces', href: '/dashboard/workspaces', icon: Server },
    { name: 'Wallet & Payouts', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Rent Workspace', href: '/dashboard/rent', icon: ShoppingBag },
    { name: 'Billing & Invoices', href: '/dashboard/billing', icon: FileText },
  ];

  return (
    <div className="min-h-screen pt-20 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar Navigation (1/4) */}
          <aside className="space-y-6">
            <div className="p-5 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {roles[0] || 'AGENT_OWNER'}
                </span>
                <p className="text-xs font-mono text-slate-500 truncate pt-1">
                  {user?.email || user?.id}
                </p>
              </div>

              {/* Nav Links */}
              <nav className="space-y-1 font-mono text-xs">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-md'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Dashboard Content View (3/4) */}
          <main className="lg:col-span-3">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}
