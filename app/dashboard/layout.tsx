'use client';

import React, { useState, useEffect } from 'react';
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
  Loader2,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
    { name: 'My Agents', shortName: 'Agents', href: '/dashboard', icon: Bot },
    { name: 'Deploy Workspace', shortName: 'Deploy', href: '/dashboard/deploy', icon: PlusCircle },
    { name: 'My Workspaces', shortName: 'Workspaces', href: '/dashboard/workspaces', icon: Server },
    { name: 'Wallet & Payouts', shortName: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Rent Workspace', shortName: 'Rent', href: '/dashboard/rent', icon: ShoppingBag },
    { name: 'Billing & Invoices', shortName: 'Billing', href: '/dashboard/billing', icon: FileText },
  ];

  const activeItem = navItems.find((item) => item.href === pathname) || navItems[0];

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-24 md:pb-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Mobile Section Drawer Header (<768px) */}
        <div className="md:hidden mb-4 p-3 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              {roles[0] || 'AGENT_OWNER'}
            </span>
            <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
              {activeItem.name}
            </span>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-semibold flex items-center gap-1.5 min-h-[44px]"
            aria-label="Toggle Dashboard Menu Drawer"
          >
            {mobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>Menu</span>
          </button>
        </div>

        {/* Mobile Drawer Menu Content (<768px overlay) */}
        {mobileDrawerOpen && (
          <div className="md:hidden mb-6 p-4 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-3 shadow-xl backdrop-blur-xl">
            <div className="pb-2 border-b border-slate-200 dark:border-slate-800 space-y-1">
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Account Session</p>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                {user?.email || user?.id}
              </p>
            </div>
            <nav className="space-y-1 font-mono text-xs">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-md'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Desktop Sidebar Navigation (>=768px) */}
          <aside className="hidden md:block space-y-6">
            <div className="p-5 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl sticky top-24">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {roles[0] || 'AGENT_OWNER'}
                </span>
                <p className="text-xs font-mono text-slate-500 truncate pt-1">
                  {user?.email || user?.id}
                </p>
              </div>

              {/* Desktop Nav Links */}
              <nav className="space-y-1 font-mono text-xs">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3.5 py-3 rounded-xl transition-all min-h-[44px] ${
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

          {/* Main Dashboard Content View */}
          <main className="md:col-span-3">
            {children}
          </main>

        </div>
      </div>

      {/* Mobile Persistent Bottom Navigation Bar (<768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800/80 backdrop-blur-md px-2 py-1.5 shadow-2xl">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] ${
                  isActive
                    ? 'text-cyan-600 dark:text-cyan-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className="text-[10px] font-mono mt-0.5">{item.shortName}</span>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}

