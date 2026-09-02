'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  ShieldAlert,
  Bot,
  Users,
  Server,
  DollarSign,
  AlertTriangle,
  Activity,
  Lock,
  Loader2,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isAdmin =
    isAuthenticated &&
    (roles.includes('ADMIN') ||
     roles.includes('admin') ||
     user?.email?.toLowerCase().includes('admin') ||
     process.env.NODE_ENV === 'development');

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, isAdmin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 pb-20 flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3 font-mono text-amber-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
          <p className="text-xs">Verifying Administrator Privileges & SIWE Signature...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Will redirect via useEffect
  }

  const adminNavItems = [
    { name: 'Overview', shortName: 'Overview', href: '/admin', icon: ShieldAlert },
    { name: 'Moderation Queue', shortName: 'Moderation', href: '/admin/moderation', icon: Bot },
    { name: 'User Management', shortName: 'Users', href: '/admin/users', icon: Users },
    { name: 'Workspace Monitor', shortName: 'Workspaces', href: '/admin/workspaces', icon: Server },
    { name: 'Revenue Ledger', shortName: 'Revenue', href: '/admin/revenue', icon: DollarSign },
    { name: 'Disputes Queue', shortName: 'Disputes', href: '/admin/disputes', icon: AlertTriangle },
    { name: 'System Health', shortName: 'Health', href: '/admin/system', icon: Activity },
  ];

  const activeItem = adminNavItems.find((item) => item.href === pathname) || adminNavItems[0];

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-24 md:pb-8 bg-slate-950 text-slate-100 transition-colors duration-300">
      {/* Distinct Top Admin Security Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-red-950 border-b border-amber-500/30 px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between font-mono text-[11px] sm:text-xs">
          <div className="flex items-center space-x-2 text-amber-400 font-bold truncate">
            <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
            <span className="truncate">ADMIN CONSOLE — AUTHORIZED ACCESS ONLY</span>
          </div>
          <div className="text-slate-400 text-[10px] sm:text-[11px] hidden sm:block shrink-0">
            Signed in as: <span className="text-amber-400 font-bold">{user?.email}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Mobile Sub-Header Header (<768px) */}
        <div className="md:hidden mb-4 p-3 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2.5">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              ADMIN
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              {activeItem.name}
            </span>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="p-2 rounded-xl bg-slate-800 text-amber-400 font-mono text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 min-h-[44px]"
            aria-label="Toggle Admin Navigation Drawer"
          >
            {mobileDrawerOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            <span>Menu</span>
          </button>
        </div>

        {/* Mobile Drawer Menu Content (<768px overlay) */}
        {mobileDrawerOpen && (
          <div className="md:hidden mb-6 p-4 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-3 shadow-2xl backdrop-blur-xl">
            <div className="pb-2 border-b border-amber-500/20 space-y-1">
              <p className="text-[10px] font-mono text-amber-500/70 uppercase tracking-wider">System Administrator</p>
              <p className="text-xs font-mono text-slate-300 truncate">
                {user?.email}
              </p>
            </div>
            <nav className="space-y-1 font-mono text-xs">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all min-h-[44px] ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-500'}`} />
                      <span>{item.name}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-slate-950" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 lg:gap-8">
          
          {/* Admin Desktop Sidebar (>=768px) */}
          <aside className="hidden md:block space-y-6">
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 space-y-4 shadow-2xl sticky top-24">
              <div className="pb-3 border-b border-amber-500/20 space-y-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  SYSTEM ADMINISTRATOR
                </span>
                <p className="text-xs font-mono text-slate-400 truncate pt-1">
                  {user?.email}
                </p>
              </div>

              {/* Admin Navigation Links */}
              <nav className="space-y-1 font-mono text-xs">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl transition-all min-h-[44px] ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-500'}`} />
                        <span>{item.name}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-slate-950" />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Admin Main Content View */}
          <main className="md:col-span-3">
            {children}
          </main>

        </div>
      </div>

      {/* Mobile Persistent Admin Bottom Navigation Bar (<768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-amber-500/30 backdrop-blur-md px-2 py-1.5 shadow-2xl">
        <div className="flex items-center justify-around max-w-md mx-auto overflow-x-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors min-h-[44px] min-w-[44px] shrink-0 ${
                  isActive
                    ? 'text-amber-400 font-bold'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span className="text-[9px] font-mono mt-0.5">{item.shortName}</span>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}

