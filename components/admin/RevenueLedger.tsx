'use client';

import React, { useState } from 'react';
import { DollarSign, Download, ShieldAlert, FileSpreadsheet } from 'lucide-react';

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

  const exportToCSV = () => {
    const headers = ['Ledger ID', 'Workspace ID', 'Renter Email', 'Owner Address', 'Gross Rental (USDC)', '2% Treasury Fee (USDC)', 'Net Owner Payout (USDC)', 'Date'];
    const rows = ledgerData.map((row) => [
      row.id,
      row.workspaceId,
      row.renterEmail,
      row.ownerAddress,
      row.grossRentalUSDC.toFixed(2),
      row.treasuryFee2USDC.toFixed(2),
      row.netPayoutUSDC.toFixed(2),
      row.date,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AgentChain_Revenue_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Revenue & Platform Commission Ledger
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Treasury reconciliation: 2% commission collected vs net owner payouts
          </p>
        </div>

        <button
          onClick={exportToCSV}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-xs shadow-md hover:opacity-95 transition-opacity flex items-center space-x-2 w-fit"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
          <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">Ledger ID</th>
              <th className="p-4">Workspace</th>
              <th className="p-4">Renter</th>
              <th className="p-4">Gross Rental</th>
              <th className="p-4 text-amber-400">2% Treasury Fee</th>
              <th className="p-4 text-emerald-500">Net Owner Payout</th>
              <th className="p-4 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {ledgerData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="p-4 font-bold">{row.id}</td>
                <td className="p-4 text-slate-400">{row.workspaceId}</td>
                <td className="p-4">{row.renterEmail}</td>
                <td className="p-4 font-bold">${row.grossRentalUSDC.toFixed(2)}</td>
                <td className="p-4 text-amber-400 font-extrabold">+${row.treasuryFee2USDC.toFixed(2)}</td>
                <td className="p-4 text-emerald-500 font-bold">${row.netPayoutUSDC.toFixed(2)}</td>
                <td className="p-4 text-right text-slate-400">{row.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
          // TODO: Phase 6 - connect real financial ledger DB queries once workspace rental backend exists
        </div>
      </div>
    </div>
  );
}
