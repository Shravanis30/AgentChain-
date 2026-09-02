'use client';

import React, { useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, roles, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
    { name: 'Overview', href: '/admin', icon: ShieldAlert },
    { name: 'Moderation Queue', href: '/admin/moderation', icon: Bot },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Workspace Monitor', href: '/admin/workspaces', icon: Server },
    { name: 'Revenue Ledger', href: '/admin/revenue', icon: DollarSign },
    { name: 'Disputes Queue', href: '/admin/disputes', icon: AlertTriangle },
    { name: 'System Health', href: '/admin/system', icon: Activity },
  ];

  return (
    <div className="min-h-screen pt-20 bg-slate-950 text-slate-100 transition-colors duration-300">
      {/* Distinct Top Admin Security Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-red-950 border-b border-amber-500/30 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Lock className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>ADMIN SECURITY CONSOLE — AUTHORIZED ACCESS ONLY</span>
          </div>
          <div className="text-slate-400 text-[11px] hidden sm:block">
            Signed in as: <span className="text-amber-400 font-bold">{user?.email}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Admin Sidebar (1/4) */}
          <aside className="space-y-6">
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-amber-500/30 space-y-4 shadow-2xl">
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
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
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

          {/* Admin Main Content (3/4) */}
          <main className="lg:col-span-3">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}
