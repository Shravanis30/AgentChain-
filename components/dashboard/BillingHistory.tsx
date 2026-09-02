'use client';

import React, { useState } from 'react';
import { FileText, Printer, Download, Check, ShieldCheck } from 'lucide-react';

interface InvoiceReceipt {
  id: string;
  date: string;
  item: string;
  amountUSDC: number;
  status: 'PAID' | 'REFUNDED';
  txHash: string;
}

const MOCK_INVOICES: InvoiceReceipt[] = [
  {
    id: 'INV-2026-0891',
    date: '2026-08-29',
    item: 'Solidity Guard Sentinel (142 hrs Workspace Lease)',
    amountUSDC: 2059.00,
    status: 'PAID',
    txHash: '0x8F3a2b4c9d1e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
  },
  {
    id: 'INV-2026-0742',
    date: '2026-08-27',
    item: 'Quant DAG Arbitrageur (98 hrs Workspace Lease)',
    amountUSDC: 2156.00,
    status: 'PAID',
    txHash: '0x3C44CdD06a900fa2b585dd299e03d12FA4293BC0',
  },
  {
    id: 'INV-2026-0510',
    date: '2026-08-20',
    item: 'DocuExtract Pro (45 hrs Workspace Lease)',
    amountUSDC: 393.75,
    status: 'PAID',
    txHash: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
];

export function BillingHistory() {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceReceipt | null>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-500" />
            Billing History & Receipts
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Downloadable PDF invoices & oracle payment receipts
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {MOCK_INVOICES.length} Invoices
        </span>
      </div>

      {/* Invoice Table */}
      <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">Invoice ID</th>
              <th className="p-4">Date</th>
              <th className="p-4">Lease Description</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {MOCK_INVOICES.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="p-4 font-bold">{inv.id}</td>
                <td className="p-4 text-slate-400">{inv.date}</td>
                <td className="p-4 font-sans text-xs">{inv.item}</td>
                <td className="p-4 font-bold text-slate-900 dark:text-white">${inv.amountUSDC.toFixed(2)} USDC</td>
                <td className="p-4">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">
                    {inv.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => setSelectedInvoice(inv)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] inline-flex items-center space-x-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Receipt</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
          // TODO: Phase 6 - wire to real PDF invoice generation endpoint once backend billing system exists
        </div>
      </div>

      {/* Printable Receipt Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-white text-slate-900 space-y-6 shadow-2xl border border-slate-300 print:shadow-none print:border-none print:w-full">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold">AgentChain Protocol</h3>
                <p className="text-xs text-slate-500 font-mono">Official Payment Receipt</p>
              </div>
              <span className="text-sm font-mono font-bold text-emerald-600">PAID</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice ID:</span>
                <span className="font-bold">{selectedInvoice.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{selectedInvoice.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Hash:</span>
                <span className="text-[10px] text-slate-600 truncate max-w-[200px]">{selectedInvoice.txHash}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs font-mono">
              <div className="flex justify-between font-bold">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between text-slate-700 font-sans text-xs">
                <span>{selectedInvoice.item}</span>
                <span className="font-mono">${selectedInvoice.amountUSDC.toFixed(2)} USDC</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold text-xs"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
