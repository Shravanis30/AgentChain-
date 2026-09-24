'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Server, DollarSign, ShieldAlert, PieChart, TrendingUp, Layers, RefreshCw, Loader2 } from 'lucide-react';
import { useINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';
import { api, AdminStats } from '@/lib/api-client';

export function OverviewCards() {
  const { formatAsINR } = useINR();
  const [statsData, setStatsData] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchStats = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await api.getAdminStats();
      setStatsData(data);
    } catch (err) {
      console.warn('Failed to load real admin overview metrics:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stats = [
    {
      title: 'Total Platform Agents',
      value: `${statsData?.total_agents ?? 0} Agents`,
      subtitle: `${statsData?.published_agents ?? 0} Published • ${statsData?.pending_agents ?? 0} Pending Review`,
      icon: Bot,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      title: 'Active Workspaces',
      value: `${statsData?.total_workspaces ?? 0} Containers`,
      subtitle: `${statsData?.running_workspaces ?? 0} Running • ${statsData?.stopped_workspaces ?? 0} Standby`,
      icon: Server,
      color: 'text-rose-600 dark:text-rose-500',
      bgColor: 'bg-rose-500/10 border-rose-500/30',
    },
    {
      title: 'Task Escrow GMV',
      value: formatAsINR(statsData?.task_escrow_gmv_usdc ?? 0),
      subtitle: `$${(statsData?.task_escrow_gmv_usdc ?? 0).toFixed(2)} USDC • 85/10/5 Smart Escrow`,
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      title: 'Workspace Rental GMV',
      value: formatAsINR(statsData?.workspace_rental_gmv_usdc ?? 0),
      subtitle: `$${(statsData?.workspace_rental_gmv_usdc ?? 0).toFixed(2)} USDC • Container Lease Volume`,
      icon: Layers,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
    },
    {
      title: '2% Treasury Fees',
      value: formatAsINR(statsData?.treasury_fees_usdc ?? 0, true),
      subtitle: `$${(statsData?.treasury_fees_usdc ?? 0).toFixed(2)} USDC Platform Commission`,
      icon: DollarSign,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      title: 'Escrow Distributions',
      value: `${formatAsINR(statsData?.dev_distributions_usdc ?? 0)} Devs`,
      subtitle: `${formatAsINR(statsData?.staker_distributions_usdc ?? 0)} Stakers • ${formatAsINR(statsData?.dao_distributions_usdc ?? 0)} DAO`,
      icon: PieChart,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            Platform Security & Revenue Overview
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
            High-level metrics strictly separating Task Escrow vs Workspace Rental revenue
          </p>
          <div className="pt-1">
            <CurrencyDisclaimer />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm"
            title="Refresh database metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="text-xs font-mono px-2.5 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 w-fit">
            LIVE METRICS
          </span>
        </div>
      </div>

      {isLoading && !statsData ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto mb-2" />
          <p className="text-xs font-mono text-slate-500">Querying real database metrics from PostgreSQL...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm hover:shadow-md hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400">{stat.title}</span>
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${stat.bgColor} ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
                    {stat.value}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                    {stat.subtitle}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-cyan-700 dark:text-cyan-400">
        <span>Platform metrics aggregated in real-time from PostgreSQL database, on-chain task escrows, and active workspace leases.</span>
        <CurrencyDisclaimer />
      </div>
    </div>
  );
}
