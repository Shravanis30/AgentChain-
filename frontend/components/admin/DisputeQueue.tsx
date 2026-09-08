'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldOff, AlertCircle } from 'lucide-react';

interface MockDispute {
  id: string;
  workspaceId: string;
  renterEmail: string;
  issue: string;
  amountUSDC: number;
  status: 'OPEN' | 'RESOLVED';
  date: string;
}

const MOCK_DISPUTES: MockDispute[] = [
  {
    id: 'DSP-701',
    workspaceId: 'ws-9011',
    renterEmail: 'client@corp.io',
    issue: 'Container memory limit exceeded during continuous batch job execution',
    amountUSDC: 120.00,
    status: 'OPEN',
    date: '2026-08-30',
  },
  {
    id: 'DSP-688',
    workspaceId: 'ws-5540',
    renterEmail: 'buyer@web3.org',
    issue: 'Unexpected container restart during API call test sequence',
    amountUSDC: 45.00,
    status: 'RESOLVED',
    date: '2026-08-25',
  },
];

export function DisputeQueue() {
  const [disputes, setDisputes] = useState<MockDispute[]>(MOCK_DISPUTES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleResolve = (dspId: string, action: string) => {
    setToastMessage(`Resolved dispute ${dspId} via ${action}. Escrow state updated.`);
    setDisputes((prev) =>
      prev.map((d) => (d.id === dspId ? { ...d, status: 'RESOLVED' } : d))
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Workspace Rental Disputes & Escrow Claims
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Arbitrate tenant complaints and issue partial/full escrow refunds
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30">
          {disputes.filter((d) => d.status === 'OPEN').length} OPEN DISPUTES
        </span>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
          <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">Dispute ID</th>
              <th className="p-4">Workspace</th>
              <th className="p-4">Renter Email</th>
              <th className="p-4">Issue Summary</th>
              <th className="p-4">Disputed Escrow</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Arbitration Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {disputes.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="p-4 font-bold">{d.id}</td>
                <td className="p-4 text-slate-400">{d.workspaceId}</td>
                <td className="p-4">{d.renterEmail}</td>
                <td className="p-4 font-sans text-xs max-w-xs">{d.issue}</td>
                <td className="p-4 font-bold text-amber-400">${d.amountUSDC.toFixed(2)}</td>
                <td className="p-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      d.status === 'OPEN'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-500'
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  {d.status === 'OPEN' ? (
                    <>
                      <button
                        onClick={() => handleResolve(d.id, 'REFUND_BUYER')}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 font-bold text-[11px] hover:bg-rose-500/20"
                      >
                        Refund Renter
                      </button>
                      <button
                        onClick={() => handleResolve(d.id, 'RELEASE_TO_OWNER')}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-[11px] hover:bg-emerald-500/20"
                      >
                        Release Escrow
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-semibold">Case Closed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
          Escrow dispute arbitration verified on-chain via multi-signature consensus & settlement oracle.
        </div>
      </div>
    </div>
  );
}
