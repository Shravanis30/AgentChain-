'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Wallet, ArrowDownRight, ArrowUpRight, ShieldCheck, DollarSign, Download, Lock, Check } from 'lucide-react';

interface TaskEscrowTx {
  id: string;
  taskId: string;
  grossAmountUSDC: number;
  devPayout85USDC: number;
  stakers10USDC: number;
  daoFee5USDC: number;
  status: 'SETTLED' | 'PENDING';
  timestamp: string;
}

interface WorkspaceRentalTx {
  id: string;
  workspaceId: string;
  renterAddress: string;
  grossRentalUSDC: number;
  platformFee2USDC: number;
  netPayoutUSDC: number;
  durationHours: number;
  timestamp: string;
}

const MOCK_TASK_ESCROW_TXS: TaskEscrowTx[] = [
  {
    id: 'tx-task-101',
    taskId: 'task-8f3a-99d1',
    grossAmountUSDC: 50.00,
    devPayout85USDC: 42.50,
    stakers10USDC: 5.00,
    daoFee5USDC: 2.50,
    status: 'SETTLED',
    timestamp: '2026-08-30T14:20:00Z',
  },
  {
    id: 'tx-task-102',
    taskId: 'task-4b21-88c0',
    grossAmountUSDC: 120.00,
    devPayout85USDC: 102.00,
    stakers10USDC: 12.00,
    daoFee5USDC: 6.00,
    status: 'SETTLED',
    timestamp: '2026-08-28T09:15:00Z',
  },
];

const MOCK_WORKSPACE_RENTAL_TXS: WorkspaceRentalTx[] = [
  {
    id: 'tx-rent-501',
    workspaceId: 'ws-8941',
    renterAddress: '0x3C44...93BC',
    grossRentalUSDC: 2059.00,
    platformFee2USDC: 41.18,
    netPayoutUSDC: 2017.82,
    durationHours: 142,
    timestamp: '2026-08-29T18:00:00Z',
  },
  {
    id: 'tx-rent-502',
    workspaceId: 'ws-7712',
    renterAddress: '0x90F7...b906',
    grossRentalUSDC: 2156.00,
    platformFee2USDC: 43.12,
    netPayoutUSDC: 2112.88,
    durationHours: 98,
    timestamp: '2026-08-27T11:45:00Z',
  },
];

export function EarningsCard() {
  const { user } = useAuth();
  const [withdrawToast, setWithdrawToast] = useState<boolean>(false);

  const primaryWallet =
    user?.wallets && user.wallets.length > 0
      ? user.wallets[0].wallet_address
      : '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

  const handleWithdraw = () => {
    setWithdrawToast(true);
    setTimeout(() => setWithdrawToast(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Wallet Balance Header */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
              <Wallet className="w-4 h-4 text-cyan-500" />
              <span>PRIMARY CONNECTED WALLET</span>
            </div>
            <div className="text-sm font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{primaryWallet}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                VERIFIED SIWE
              </span>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleWithdraw}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:opacity-95 transition-opacity flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Withdraw USDC Payout</span>
            </button>
          </div>
        </div>

        {withdrawToast && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono text-xs">
            // TODO: Phase 6 - Automatic Polygon smart contract escrow withdrawal triggered via Web3 wallet call.
          </div>
        )}
      </div>

      {/* REVENUE STREAM 1: TASK ESCROW EARNINGS (85 / 10 / 5 Split) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              Task Escrow Earnings (Solidity 85/10/5 Escrow)
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Direct task executions settled via smart contract oracle
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-500">
            Total: $144.50 Net Dev (85%)
          </span>
        </div>

        <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Tx ID / Task</th>
                <th className="p-4">Gross Task Value</th>
                <th className="p-4 text-emerald-500">Dev Payout (85%)</th>
                <th className="p-4 text-purple-400">Stakers (10%)</th>
                <th className="p-4 text-cyan-400">DAO Fee (5%)</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {MOCK_TASK_ESCROW_TXS.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="p-4">
                    <div className="font-bold">{tx.id}</div>
                    <div className="text-[10px] text-slate-400">{tx.taskId}</div>
                  </td>
                  <td className="p-4 font-bold">${tx.grossAmountUSDC.toFixed(2)}</td>
                  <td className="p-4 font-extrabold text-emerald-500">${tx.devPayout85USDC.toFixed(2)}</td>
                  <td className="p-4 text-purple-400">${tx.stakers10USDC.toFixed(2)}</td>
                  <td className="p-4 text-cyan-400">${tx.daoFee5USDC.toFixed(2)}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                      {tx.status}
                    </span>
                  </td>
                  <td className="p-4 text-right text-slate-400 text-[11px]">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVENUE STREAM 2: WORKSPACE RENTAL EARNINGS (2% Platform Commission) */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-cyan-500" />
              Workspace Rental Earnings (2% Platform Fee Deducted)
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Third-party container rentals (kept strictly separate from task escrow)
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-500">
            Total: $4,130.70 Net Rental Payout
          </span>
        </div>

        <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Rental Tx / Workspace</th>
                <th className="p-4">Renter Address</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Gross Rental Income</th>
                <th className="p-4 text-rose-500">2% Platform Fee</th>
                <th className="p-4 text-cyan-500">Net Owner Payout</th>
                <th className="p-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {MOCK_WORKSPACE_RENTAL_TXS.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                  <td className="p-4">
                    <div className="font-bold">{tx.id}</div>
                    <div className="text-[10px] text-slate-400">{tx.workspaceId}</div>
                  </td>
                  <td className="p-4 text-slate-400">{tx.renterAddress}</td>
                  <td className="p-4">{tx.durationHours} hrs</td>
                  <td className="p-4 font-bold">${tx.grossRentalUSDC.toFixed(2)}</td>
                  <td className="p-4 text-rose-500 font-bold">-${tx.platformFee2USDC.toFixed(2)}</td>
                  <td className="p-4 font-extrabold text-cyan-500">${tx.netPayoutUSDC.toFixed(2)}</td>
                  <td className="p-4 text-right text-slate-400 text-[11px]">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
            // TODO: Phase 6 - wire to real GET /api/v1/workspaces/earnings endpoint once workspace rental billing backend exists
          </div>
        </div>
      </div>
    </div>
  );
}
