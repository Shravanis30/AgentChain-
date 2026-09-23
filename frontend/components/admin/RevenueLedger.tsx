'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Download,
  ShieldAlert,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useINR, formatINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';

interface LedgerRow {
  id: string;
  workspaceId: string;
  renterEmail: string;
  ownerAddress: string;
  grossRentalUSDC: number;
  treasuryFee2USDC: number;
  netPayoutUSDC: number;
  date: string;
}

const MOCK_LEDGER: LedgerRow[] = [
  {
    id: 'LEDGER-9001',
    workspaceId: 'ws-8941',
    renterEmail: 'trader.eth@polygon.org',
    ownerAddress: '0x71C7...976F',
    grossRentalUSDC: 2059.00,
    treasuryFee2USDC: 41.18,
    netPayoutUSDC: 2017.82,
    date: '2026-08-29',
  },
  {
    id: 'LEDGER-9002',
    workspaceId: 'ws-7712',
    renterEmail: 'dev.quantum@solidity.io',
    ownerAddress: '0x3C44...93BC',
    grossRentalUSDC: 2156.00,
    treasuryFee2USDC: 43.12,
    netPayoutUSDC: 2112.88,
    date: '2026-08-27',
  },
  {
    id: 'LEDGER-9003',
    workspaceId: 'ws-5540',
    renterEmail: 'enterprise@corp.com',
    ownerAddress: '0x90F7...b906',
    grossRentalUSDC: 393.75,
    treasuryFee2USDC: 7.88,
    netPayoutUSDC: 385.87,
    date: '2026-08-20',
  },
];

export function RevenueLedger() {
  const [ledgerData] = useState<LedgerRow[]>(MOCK_LEDGER);
  const [showUsdcBreakdown, setShowUsdcBreakdown] = useState<boolean>(false);
  const { formatAsINR, rate } = useINR();

  const totalCommissionUSDC = ledgerData.reduce((acc, r) => acc + r.treasuryFee2USDC, 0);
  const totalGrossUSDC = ledgerData.reduce((acc, r) => acc + r.grossRentalUSDC, 0);
  const totalNetPayoutUSDC = ledgerData.reduce((acc, r) => acc + r.netPayoutUSDC, 0);

  const exportToCSV = () => {
    const headers = [
      'Ledger ID',
      'Workspace ID',
      'Renter Email',
      'Owner Address',
      'Gross Rental (INR)',
      'Gross Rental (USDC)',
      '2% Treasury Fee (INR)',
      '2% Treasury Fee (USDC)',
      'Net Owner Payout (INR)',
      'Net Owner Payout (USDC)',
      'Date',
    ];
    const rows = ledgerData.map((row) => [
      row.id,
      row.workspaceId,
      row.renterEmail,
      row.ownerAddress,
      (row.grossRentalUSDC * rate).toFixed(2),
      row.grossRentalUSDC.toFixed(2),
      (row.treasuryFee2USDC * rate).toFixed(2),
      row.treasuryFee2USDC.toFixed(2),
      (row.netPayoutUSDC * rate).toFixed(2),
      row.netPayoutUSDC.toFixed(2),
      row.date,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `AgentChain_Revenue_Ledger_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            Revenue & Platform Commission Ledger
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
            Treasury reconciliation: 2% commission collected vs net owner payouts
          </p>
          <div className="pt-1">
            <CurrencyDisclaimer />
          </div>
        </div>

        <button
          onClick={exportToCSV}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 hover:opacity-95 transition-opacity flex items-center space-x-2 w-fit"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Admin Revenue Reconciliation Summary Card */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 block uppercase">
              Total Platform Commission Collected (2% Treasury Cut)
            </span>
            <div className="text-3xl font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {formatAsINR(totalCommissionUSDC, true)}
            </div>
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
              Primary fiat reconciliation figure (Exchange Rate: 1 USDC ≈ ₹{rate.toFixed(2)})
            </div>
          </div>

          <button
            onClick={() => setShowUsdcBreakdown(!showUsdcBreakdown)}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors flex items-center space-x-1.5 w-fit"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            <span>{showUsdcBreakdown ? 'Hide On-Chain USDC Breakdown' : 'Expand On-Chain USDC Totals'}</span>
            {showUsdcBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Expandable On-Chain Settlement Details */}
        {showUsdcBreakdown && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 block text-[11px]">Gross Rental GMV</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                ${totalGrossUSDC.toFixed(2)} USDC
              </div>
              <span className="text-[10px] text-slate-500">
                ≈ {formatAsINR(totalGrossUSDC)}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 block text-[11px]">2% Platform Commission</span>
              <div className="text-sm font-bold text-amber-500">
                +${totalCommissionUSDC.toFixed(2)} USDC
              </div>
              <span className="text-[10px] text-slate-500">
                ≈ {formatAsINR(totalCommissionUSDC, true)}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 block text-[11px]">Net Owner Payouts</span>
              <div className="text-sm font-bold text-emerald-500">
                ${totalNetPayoutUSDC.toFixed(2)} USDC
              </div>
              <span className="text-[10px] text-slate-500">
                ≈ {formatAsINR(totalNetPayoutUSDC, true)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table with INR Primary and USDC Supporting */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Ledger ID</th>
                <th className="p-4">Workspace</th>
                <th className="p-4">Renter</th>
                <th className="p-4">Gross Rental</th>
                <th className="p-4 text-amber-700 dark:text-amber-400">2% Treasury Fee</th>
                <th className="p-4 text-emerald-700 dark:text-emerald-400">Net Owner Payout</th>
                <th className="p-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {ledgerData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{row.id}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{row.workspaceId}</td>
                  <td className="p-4 text-slate-700 dark:text-slate-300">{row.renterEmail}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {formatAsINR(row.grossRentalUSDC)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      ${row.grossRentalUSDC.toFixed(2)} USDC
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-amber-700 dark:text-amber-400 font-extrabold">
                      +{formatAsINR(row.treasuryFee2USDC, true)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      +${row.treasuryFee2USDC.toFixed(2)} USDC
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {formatAsINR(row.netPayoutUSDC, true)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      ${row.netPayoutUSDC.toFixed(2)} USDC
                    </div>
                  </td>
                  <td className="p-4 text-right text-slate-500 dark:text-slate-400">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>
            Financial ledger records gross volume, 2% platform treasury cuts, and net owner payouts in INR with on-chain USDC settlement.
          </span>
          <CurrencyDisclaimer />
        </div>
      </div>
    </div>
  );
}
