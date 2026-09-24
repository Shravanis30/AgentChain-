'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Check, X, ShieldAlert, Bot, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api-client';

export function ModerationQueue() {
  const { user } = useAuth();
  const [pendingAgents, setPendingAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadPending = () => {
    setIsLoading(true);
    api.getPendingAgents()
      .then((items) => {
        setPendingAgents(Array.isArray(items) ? items : []);
      })
      .catch((err) => {
        console.error('Failed to load pending agents:', err);
        setPendingAgents([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (agent: any) => {
    // Self-approval restriction check
    const isOwner = Boolean(
      user && (
        agent.owner_id === user.id ||
        (agent.owner_wallet && (user as any)?.wallet_address && agent.owner_wallet.toLowerCase() === (user as any).wallet_address.toLowerCase())
      )
    );

    if (isOwner) {
      setToastMessage('Self-approval blocked: Admins cannot approve their own submitted agents!');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    try {
      await api.approveAgent(agent.id);
      setToastMessage(`Agent "${agent.name}" approved & published to Marketplace!`);
      loadPending();
    } catch (err: any) {
      setToastMessage(`Approval failed: ${err?.message || 'Server error approving agent.'}`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleReject = async (agent: any) => {
    try {
      await api.rejectAgent(agent.id, 'Agent rejected by administrator during moderation.');
      setToastMessage(`Agent "${agent.name}" rejected and marked as REJECTED.`);
      loadPending();
    } catch (err: any) {
      setToastMessage(`Rejection failed: ${err?.message || 'Server error rejecting agent.'}`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            Agent Moderation Queue
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
            Review and approve developer submissions before public marketplace publication
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 w-fit">
          {pendingAgents.length} PENDING
        </span>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-center font-mono text-xs text-slate-500 shadow-sm dark:shadow-xl">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600 dark:text-amber-500" />
          Loading moderation queue...
        </div>
      ) : pendingAgents.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-sm dark:shadow-xl">
          <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Moderation Queue Clear!</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">No pending agent approval submissions.</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl w-full max-w-full">
          <div className="overflow-x-auto w-full max-w-full">
            <table className="w-full text-left font-mono text-xs min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Agent Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Owner ID</th>
                <th className="p-4">Price</th>
                <th className="p-4">Self-Approval Rule</th>
                <th className="p-4 text-right">Moderation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {pendingAgents.map((agent) => {
                const isOwner = Boolean(
                  user && (
                    agent.owner_id === user.id ||
                    (agent.owner_wallet && (user as any)?.wallet_address && agent.owner_wallet.toLowerCase() === (user as any).wallet_address.toLowerCase())
                  )
                );

                const displayOwner = agent.owner_wallet
                  ? `${agent.owner_wallet.slice(0, 6)}...${agent.owner_wallet.slice(-4)}`
                  : agent.owner_id;

                const priceLabel = agent.pricing_model === 'hourly_lease' ? '/ hr' : '/ call';

                return (
                  <tr key={agent.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{agent.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{agent.id} • {agent.latest_version || agent.current_version || 'v1.0.0'}</div>
                    </td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px] border border-slate-200 dark:border-slate-700">
                        {agent.category || 'General'}
                      </span>
                    </td>

                    <td className="p-4 text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title={agent.owner_wallet || agent.owner_id}>
                      {displayOwner}
                    </td>

                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      ${(agent.price_per_call_usdc || 0).toFixed(2)} {priceLabel}
                    </td>

                    <td className="p-4">
                      {isOwner ? (
                        <span className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold text-[10px] border border-rose-500/30 flex items-center w-fit gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Self-Approval Blocked
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                          Eligible for Approval
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleReject(agent)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold text-[11px] hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
                      >
                        Reject
                      </button>

                      <button
                        disabled={isOwner}
                        onClick={() => handleApprove(agent)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                          isOwner
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30 border border-emerald-600/30 dark:border-emerald-500/40 shadow-sm'
                        }`}
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
