'use client';

import React, { useState } from 'react';
import { Users, Shield, UserX, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MockUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'DEVELOPER' | 'BUYER';
  walletAddress: string | null;
  joinedDate: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

const MOCK_USERS: MockUser[] = [
  {
    id: 'usr-901',
    email: 'admin@agentchain.ai',
    role: 'ADMIN',
    walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    joinedDate: '2026-08-01',
    status: 'ACTIVE',
  },
  {
    id: 'usr-842',
    email: 'dev.quantum@solidity.io',
    role: 'DEVELOPER',
    walletAddress: '0x3C44CdD06a900fa2b585dd299e03d12FA4293BC0',
    joinedDate: '2026-08-14',
    status: 'ACTIVE',
  },
  {
    id: 'usr-615',
    email: 'trader.eth@polygon.org',
    role: 'BUYER',
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    joinedDate: '2026-08-20',
    status: 'ACTIVE',
  },
  {
    id: 'usr-409',
    email: 'spammer@tempmail.com',
    role: 'BUYER',
    walletAddress: null,
    joinedDate: '2026-08-28',
    status: 'SUSPENDED',
  },
];

export function UserTable() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAction = (userEmail: string, actionName: string) => {
    setToastMessage(`Executed administrative ${actionName} on user ${userEmail}.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            User Account Management
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Platform user directory, SIWE wallet links, and access suspension
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30">
          {users.length} REGISTERED ACCOUNTS
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
          <table className="w-full text-left font-mono text-xs min-w-[650px]">
          <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">User Email / ID</th>
              <th className="p-4">Role</th>
              <th className="p-4">SIWE Wallet Link</th>
              <th className="p-4">Joined Date</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Admin Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="p-4">
                  <div className="font-bold text-slate-900 dark:text-white">{u.email}</div>
                  <div className="text-[10px] text-slate-400">{u.id}</div>
                </td>

                <td className="p-4">
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      u.role === 'ADMIN'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                        : u.role === 'DEVELOPER'
                        ? 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/30'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>

                <td className="p-4 font-mono text-[11px] text-slate-400">
                  {u.walletAddress ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {u.walletAddress.slice(0, 6)}...{u.walletAddress.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal">Not Linked</span>
                  )}
                </td>

                <td className="p-4 text-slate-400">{u.joinedDate}</td>

                <td className="p-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-rose-500/10 text-rose-500'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>

                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleAction(u.email, 'SUSPEND')}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] hover:bg-rose-500/20 hover:text-rose-500 transition-colors"
                  >
                    Suspend
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
          User account access & RBAC permissions updated via administrative policy controls.
        </div>
      </div>
    </div>
  );
}
