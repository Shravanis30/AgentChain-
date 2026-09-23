'use client';

import React from 'react';
import { Bot, Server, DollarSign, ShieldAlert, PieChart, TrendingUp, Layers } from 'lucide-react';
import { useINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';

export function OverviewCards() {
  const { formatAsINR } = useINR();

  const stats = [
    {
      title: 'Total Platform Agents',
      value: '48 Agents',
      subtitle: '34 Published • 14 Pending Review',
      icon: Bot,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      title: 'Active Workspaces',
      value: '14 Containers',
      subtitle: '12 Running • 2 Idle Standby',
      icon: Server,
      color: 'text-rose-600 dark:text-rose-500',
      bgColor: 'bg-rose-500/10 border-rose-500/30',
    },
    {
      title: 'Task Escrow GMV',
      value: formatAsINR(18450),
      subtitle: '$18,450.00 USDC • 85/10/5 Smart Escrow',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      title: 'Workspace Rental GMV',
      value: formatAsINR(34890),
      subtitle: '$34,890.00 USDC • Container Lease Volume',
      icon: Layers,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
    },
    {
      title: '2% Treasury Fees',
      value: formatAsINR(697.80, true),
      subtitle: '$697.80 USDC Platform Commission',
      icon: DollarSign,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      title: 'Escrow Distributions',
      value: `${formatAsINR(15682.50)} Devs`,
      subtitle: `${formatAsINR(1845)} Stakers • ${formatAsINR(922.50)} DAO ($18.45k USDC)`,
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
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 w-fit">
          ADMIN METRICS
        </span>
      </div>

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

      <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-cyan-700 dark:text-cyan-400">
        <span>Platform metrics aggregated from on-chain escrow settlements and active container lease runtimes.</span>
        <CurrencyDisclaimer />
      </div>
    </div>
  );
}
