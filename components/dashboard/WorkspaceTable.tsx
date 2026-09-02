'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, Play, Pause, Terminal, ExternalLink, ShieldCheck, DollarSign, Activity } from 'lucide-react';

interface MockWorkspace {
  id: string;
  agentName: string;
  version: string;
  tier: string;
  status: 'RUNNING' | 'STOPPED';
  uptimeHours: number;
  pricingRate: string;
  grossEarningsUSDC: number;
  commissionRatePercent: number; // 2%
  createdAt: string;
}

const INITIAL_MOCK_WORKSPACES: MockWorkspace[] = [
  {
    id: 'ws-8941',
    agentName: 'Solidity Guard Sentinel',
    version: 'v1.4.2',
    tier: 'MEDIUM (4 vCPU / 8 GB)',
    status: 'RUNNING',
    uptimeHours: 142,
    pricingRate: '$14.50 / hr',
    grossEarningsUSDC: 2059.00,
    commissionRatePercent: 2.0,
    createdAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'ws-7712',
    agentName: 'Quant DAG Arbitrageur',
    version: 'v2.1.0',
    tier: 'LARGE (8 vCPU / 16 GB)',
    status: 'RUNNING',
    uptimeHours: 98,
    pricingRate: '$22.00 / hr',
    grossEarningsUSDC: 2156.00,
    commissionRatePercent: 2.0,
    createdAt: '2026-08-27T14:30:00Z',
  },
  {
    id: 'ws-5540',
    agentName: 'DocuExtract Pro',
    version: 'v1.0.5',
    tier: 'SMALL (2 vCPU / 4 GB)',
    status: 'STOPPED',
    uptimeHours: 45,
    pricingRate: '$8.75 / hr',
    grossEarningsUSDC: 393.75,
    commissionRatePercent: 2.0,
    createdAt: '2026-08-20T09:15:00Z',
  },
];

import { api } from '@/lib/api-client';

export function WorkspaceTable() {
  const [workspaces, setWorkspaces] = useState<any[]>(INITIAL_MOCK_WORKSPACES);

  useEffect(() => {
    api.getMyWorkspaces().then((data) => {
      if (data && data.length > 0) {
        setWorkspaces(
          data.map((w: any) => ({
            id: w.id,
            agentName: 'Agent Workspace',
            version: 'v1.0.0',
            tier: w.resource_tier,
            status: w.status,
            uptimeHours: Math.floor((w.uptime_seconds || 0) / 3600) || 1,
            pricingRate: `$${floatVal(w.rate_usdc).toFixed(2)} / hr`,
            grossEarningsUSDC: floatVal(w.rate_usdc) * 10,
            commissionRatePercent: 2.0,
            createdAt: w.created_at,
          }))
        );
      }
    });
  }, []);

  const floatVal = (val: any) => (typeof val === 'number' ? val : parseFloat(val || 15.0));

  const toggleStatus = async (id: string) => {
    try {
      await api.stopWorkspace(id);
    } catch (err) {
      console.warn('Stop workspace notice:', err);
    }
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === id
          ? { ...ws, status: ws.status === 'RUNNING' ? 'STOPPED' : 'RUNNING' }
          : ws
      )
    );
  };

  // TODO: Phase 6 - replace with real GET /api/v1/workspaces endpoint once workspace backend exists

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-500" />
            My Deployed Workspaces
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Active container instances leased by third-party buyers
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {workspaces.length} Deployed Workspaces
        </span>
      </div>

      {/* Table Container */}
      <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Workspace / Agent</th>
                <th className="p-4">Resource Tier</th>
                <th className="p-4">Status</th>
                <th className="p-4">Uptime</th>
                <th className="p-4">Pricing Rate</th>
                <th className="p-4">Gross Earnings</th>
                <th className="p-4 text-rose-500">2% Platform Fee</th>
                <th className="p-4 text-emerald-500">Net Payout</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {workspaces.map((ws) => {
                const commissionUSDC = (ws.grossEarningsUSDC * ws.commissionRatePercent) / 100;
                const netPayoutUSDC = ws.grossEarningsUSDC - commissionUSDC;

                return (
                  <tr key={ws.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{ws.agentName}</div>
                      <div className="text-[10px] text-slate-400">{ws.id} • {ws.version}</div>
                    </td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                        {ws.tier}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          ws.status === 'RUNNING'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${ws.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                        {ws.status}
                      </span>
                    </td>

                    <td className="p-4">{ws.uptimeHours} hrs</td>

                    <td className="p-4 font-bold">{ws.pricingRate}</td>

                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      ${ws.grossEarningsUSDC.toFixed(2)}
                    </td>

                    {/* 2% Commission Line Item shown separately */}
                    <td className="p-4 text-rose-500 font-bold">
                      -${commissionUSDC.toFixed(2)} <span className="text-[10px] text-slate-400">(2%)</span>
                    </td>

                    <td className="p-4 text-emerald-500 font-extrabold text-sm">
                      ${netPayoutUSDC.toFixed(2)}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => toggleStatus(ws.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors"
                      >
                        {ws.status === 'RUNNING' ? 'Stop' : 'Start'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
          // TODO: Phase 6 - wire to real GET /api/v1/workspaces endpoint once workspace backend exists
        </div>
      </div>
    </div>
  );
}
