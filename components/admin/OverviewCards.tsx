'use client';

import React from 'react';
import { Bot, Server, DollarSign, ShieldAlert, PieChart, TrendingUp, Layers } from 'lucide-react';

export function OverviewCards() {
  const stats = [
    {
      title: 'Total Platform Agents',
      value: '48 Agents',
      subtitle: '34 Published • 14 Pending Review',
      icon: Bot,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      title: 'Active Workspaces',
      value: '14 Containers',
      subtitle: '12 Running • 2 Idle Standby',
      icon: Server,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10 border-red-500/30',
    },
    {
      title: 'Task Escrow GMV',
      value: '$18,450.00',
      subtitle: 'Settled via 85/10/5 Smart Escrow',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      title: 'Workspace Rental GMV',
      value: '$34,890.00',
      subtitle: 'Lease Volume (Phase 4 Mocked)',
      icon: Layers,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10 border-cyan-500/30',
    },
    {
      title: '2% Treasury Fees',
      value: '$697.80 USDC',
      subtitle: 'Accumulated Platform Commission',
      icon: DollarSign,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10 border-amber-400/30',
    },
    {
      title: 'Escrow Distributions',
      value: '$15,682.50 Devs',
      subtitle: '$1,845.00 Stakers • $922.50 DAO',
      icon: PieChart,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Platform Security & Revenue Overview
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            High-level metrics strictly separating Task Escrow vs Workspace Rental revenue
          </p>
        </div>

        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30">
          ADMIN METRICS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-md hover:border-amber-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">{stat.title}</span>
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${stat.bgColor} ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {stat.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-600 dark:text-amber-400">
        // TODO: Phase 6 - connect real-time aggregation for workspace rental GMV once metering backend endpoint exists
      </div>
    </div>
  );
}
