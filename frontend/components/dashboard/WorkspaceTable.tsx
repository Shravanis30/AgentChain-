'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Server, Terminal, Plus, RefreshCw, Loader2, StopCircle, CheckCircle2, AlertCircle, GitBranch, ExternalLink, Lock, ShieldCheck, Check, Sparkles, ShoppingBag } from 'lucide-react';
import { api, AgentItem, WorkspaceLeaseItem } from '@/lib/api-client';
import { ExecutionLogsModal } from '@/components/dashboard/ExecutionLogsModal';
import { useINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';

interface WorkspaceItem {
  id: string;
  ownerId: string;
  agentId: string;
  tier: string;
  pricingMode: string;
  rateUsdc: number;
  status: 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'ERROR';
  dockerContainerId?: string;
  cpuUsagePercent: number;
  ramUsageMb: number;
  uptimeSeconds: number;
  createdAt: string;
  activeLease?: {
    id: string;
    renter_id: string;
    duration_hours: number;
    gross_amount_usdc: number;
    net_owner_payout: number;
    status: string;
    tx_hash?: string;
    created_at: string;
  } | null;
  totalLeasesCount?: number;
  totalEarningsUsdc?: number;
}

export function WorkspaceTable() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [leases, setLeases] = useState<WorkspaceLeaseItem[]>([]);
  const [activeTab, setActiveTab] = useState<'deployed' | 'rented'>('deployed');
  const [agentsMap, setAgentsMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [redeployingId, setRedeployingId] = useState<string | null>(null);
  const [settlingLeaseId, setSettlingLeaseId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeLogsAgent, setActiveLogsAgent] = useState<AgentItem | null>(null);

  const fetchWorkspaces = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [data, myAgents, myLeases] = await Promise.all([
        api.getMyWorkspaces(),
        api.getMyAgents().catch(() => []),
        api.getMyWorkspaceLeases().catch(() => []),
      ]);

      if (Array.isArray(myAgents)) {
        const map: Record<string, any> = {};
        myAgents.forEach((a: any) => {
          map[a.id] = a;
        });
        setAgentsMap(map);
      }

      if (Array.isArray(myLeases)) {
        setLeases(myLeases);
      }

      if (Array.isArray(data)) {
        setWorkspaces(
          data.map((w: any) => ({
            id: w.id,
            ownerId: w.owner_id,
            agentId: w.agent_id,
            tier: w.resource_tier,
            pricingMode: w.pricing_mode,
            rateUsdc: typeof w.rate_usdc === 'number' ? w.rate_usdc : parseFloat(w.rate_usdc || '15.0'),
            status: w.status,
            dockerContainerId: w.docker_container_id,
            cpuUsagePercent: typeof w.cpu_usage_percent === 'number' ? w.cpu_usage_percent : parseFloat(w.cpu_usage_percent || '0'),
            ramUsageMb: w.ram_usage_mb || 512,
            uptimeSeconds: w.uptime_seconds || 0,
            createdAt: w.created_at,
            activeLease: w.active_lease || null,
            totalLeasesCount: w.total_leases_count || 0,
            totalEarningsUsdc: w.total_earnings_usdc || 0,
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load workspaces:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const handleSettleLease = async (leaseId: string) => {
    setSettlingLeaseId(leaseId);
    try {
      await api.settleWorkspaceLease(leaseId);
      setToastMessage('Task verified OK! Escrow distributed: 85% to Creator, 10% to Platform Treasury, 5% to DAO Governance Pool.');
      await fetchWorkspaces(true);
    } catch (err: any) {
      console.error('Failed to settle workspace lease escrow:', err);
      alert(err?.message || 'Failed to settle workspace lease escrow.');
    } finally {
      setSettlingLeaseId(null);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
    // Poll real container status every 8 seconds
    const interval = setInterval(() => {
      fetchWorkspaces(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchWorkspaces]);

  const handleStop = async (id: string) => {
    setStoppingId(id);
    try {
      await api.stopWorkspace(id);
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === id ? { ...ws, status: 'STOPPED' } : ws))
      );
    } catch (err: any) {
      console.error('Failed to stop workspace:', err);
      alert(err?.message || 'Failed to stop workspace container');
    } finally {
      setStoppingId(null);
    }
  };

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const { formatAsINR } = useINR();

  const formatRate = (mode: string, rate: number) => {
    const inrStr = formatAsINR(rate);
    if (mode === 'PER_DAY') return `${inrStr} / day (≈ $${rate.toFixed(2)} USDC)`;
    if (mode === 'CUSTOM_FLAT') return `${inrStr} flat (≈ $${rate.toFixed(2)} USDC)`;
    return `${inrStr} / hr (≈ $${rate.toFixed(2)} USDC)`;
  };

  const handleRedeploy = async (agentId: string) => {
    setRedeployingId(agentId);
    try {
      await api.rebuildAgent(agentId);
      alert('Vercel/Render-style container rebuild and redeployment queued successfully!');
      fetchWorkspaces(true);
    } catch (err: any) {
      alert(err?.message || 'Failed to trigger redeploy.');
    } finally {
      setRedeployingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-mono text-xs flex items-center space-x-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-500" />
            Workspace & Escrow Management
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Active Docker container runtimes & decentralized rental escrow settlements
          </p>
          <div className="pt-1">
            <CurrencyDisclaimer />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchWorkspaces(false)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Refresh workspaces status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>
          <a
            href="/dashboard/deploy"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold font-mono text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Deploy New Workspace</span>
          </a>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('deployed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all ${
            activeTab === 'deployed'
              ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>My Deployed Containers ({workspaces.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rented')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all ${
            activeTab === 'rented'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Rented Workspaces & Escrow ({leases.length})</span>
        </button>
      </div>

      {/* Deployed Containers View */}
      {activeTab === 'deployed' && (
        <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        {isLoading && workspaces.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            <p className="text-xs font-mono text-slate-500">Querying Docker host for active workspace containers...</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 mx-auto flex items-center justify-center">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Deployed Workspaces</h3>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Launch a dedicated Docker container runtime for your agents to start hosting.
              </p>
            </div>
            <a
              href="/dashboard/deploy"
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold font-mono text-xs shadow-md hover:opacity-95 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>Provision & Launch First Workspace</span>
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs min-w-[760px]">
              <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Workspace / Project Origin</th>
                  <th className="p-4">Resource Tier</th>
                  <th className="p-4">Docker Status</th>
                  <th className="p-4">Uptime</th>
                  <th className="p-4">Pricing Rate</th>
                  <th className="p-4">Escrow / Billing</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {workspaces.map((ws) => {
                  const isStopping = stoppingId === ws.id;
                  const isRedeploying = redeployingId === ws.agentId;
                  const linkedAgent = agentsMap[ws.agentId];
                  const sourceRepo = linkedAgent?.current_version?.source_repo;

                  return (
                    <tr key={ws.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{linkedAgent?.name || `Workspace ${ws.id.slice(0, 8)}`}</span>
                        </div>
                        {sourceRepo && (
                          <div className="flex items-center space-x-1 text-[10px] text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                            <GitBranch className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[220px]">{sourceRepo}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {ws.dockerContainerId ? (
                            <span>Container: <code className="text-cyan-600 dark:text-cyan-400">{ws.dockerContainerId.slice(0, 12)}</code></span>
                          ) : (
                            <span className="text-slate-500">Unallocated</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {ws.tier} ({ws.ramUsageMb} MB)
                        </span>
                      </td>

                      <td className="p-4">
                        {ws.status === 'RUNNING' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500 animate-pulse" />
                            RUNNING
                          </span>
                        )}
                        {ws.status === 'STOPPED' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-slate-500" />
                            STOPPED
                          </span>
                        )}
                        {ws.status === 'PROVISIONING' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            <Loader2 className="w-3 h-3 animate-spin mr-1 text-amber-500" />
                            PROVISIONING
                          </span>
                        )}
                        {ws.status === 'ERROR' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                            <AlertCircle className="w-3 h-3 mr-1 text-rose-500" />
                            ERROR
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {formatUptime(ws.uptimeSeconds)}
                      </td>

                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {formatRate(ws.pricingMode, ws.rateUsdc)}
                      </td>

                      {/* Dynamic Escrow & Lease Billing Status */}
                      <td className="p-4">
                        {ws.activeLease ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                              Leased • Escrow Active
                            </span>
                            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              ${ws.activeLease.gross_amount_usdc?.toFixed(2)} USDC locked
                            </div>
                            {ws.activeLease.tx_hash && (
                              <a
                                href={`https://amoy.polygonscan.com/tx/${ws.activeLease.tx_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[9px] text-cyan-500 hover:underline inline-flex items-center gap-0.5 font-mono"
                              >
                                <span>Tx Hash</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : ws.status === 'RUNNING' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mr-1.5" />
                              Escrow Ready • Listed
                            </span>
                            <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                              <span>Ready for Rent</span>
                              <a
                                href={`/dashboard/rent?workspace_id=${ws.id}`}
                                className="text-cyan-600 dark:text-cyan-400 hover:underline font-bold"
                              >
                                Test Lease →
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-medium">
                            Container Inactive
                          </span>
                        )}
                        {(ws.totalEarningsUsdc || 0) > 0 && (
                          <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
                            Total Earned: ${ws.totalEarningsUsdc?.toFixed(2)} USDC
                          </div>
                        )}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() =>
                              setActiveLogsAgent({
                                id: ws.id,
                                name: `Workspace ${ws.id.slice(0, 8)}`,
                                slug: ws.id,
                                description: 'Virtual workspace container runtime instance.',
                                category: 'sandbox',
                                price_per_call_usdc: 0.05,
                                pricing_model: 'pay_per_call',
                                status: ws.status,
                                current_version: ws.tier,
                              } as any)
                            }
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 font-bold text-[11px] transition-colors flex items-center space-x-1"
                            title="Open Container Console"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Logs</span>
                          </button>

                          {sourceRepo && (
                            <button
                              onClick={() => handleRedeploy(ws.agentId)}
                              disabled={isRedeploying}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 font-bold text-[11px] transition-colors flex items-center space-x-1 disabled:opacity-50"
                              title="Redeploy from GitHub repository"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRedeploying ? 'animate-spin' : ''}`} />
                              <span>{isRedeploying ? 'Building...' : 'Redeploy'}</span>
                            </button>
                          )}

                          {ws.status === 'RUNNING' ? (
                            <button
                              onClick={() => handleStop(ws.id)}
                              disabled={isStopping}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition-colors flex items-center space-x-1 disabled:opacity-50"
                            >
                              {isStopping ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Stopping...</span>
                                </>
                              ) : (
                                <>
                                  <StopCircle className="w-3.5 h-3.5" />
                                  <span>Stop</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 text-slate-400 text-[11px] font-mono">
                              Inactive
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <span>Docker Engine single-host isolation • Polled every 8 seconds</span>
          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Live Docker SDK Connected
          </span>
        </div>
      </div>
      )}

      {/* Rented Workspaces & Smart Contract Escrow View */}
      {activeTab === 'rented' && (
        <div className="rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl space-y-0">
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />
              <span>
                <strong>Smart Contract Escrow Protection:</strong> 100% of rental funds are securely locked in escrow. Once you verify the agent task execution is satisfactory, click <strong>Task OK</strong> to release: <strong>85% to Workspace Owner</strong>, <strong>10% to Platform Treasury</strong>, and <strong>5% to DAO Governance Pool</strong>.
              </span>
            </div>
            <a
              href="/dashboard/rent"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-[11px] shrink-0 hover:opacity-95 transition-opacity flex items-center gap-1.5 w-fit"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>+ Rent New Workspace</span>
            </a>
          </div>

          {leases.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Active Rented Workspaces</h3>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  You haven't rented any workspace containers yet. Browse available agent swarms to lease dedicated runtimes.
                </p>
              </div>
              <a
                href="/dashboard/rent"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold font-mono text-xs shadow-md hover:opacity-95 transition-opacity"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Browse & Rent Agents</span>
              </a>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs min-w-[760px]">
                <thead className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Agent / Workspace</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Escrow Deposit</th>
                    <th className="p-4">85 / 10 / 5 Split Breakdown</th>
                    <th className="p-4">Escrow Status</th>
                    <th className="p-4 text-right">Escrow Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {leases.map((l) => {
                    const isSettling = settlingLeaseId === l.id;
                    const isLocked = l.status === 'ESCROW_LOCKED' || l.status === 'ACTIVE';

                    return (
                      <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">{l.agent_name || 'Autonomous Agent'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Lease ID: {l.id.slice(0, 8)}...</div>
                          {l.owner_name && (
                            <div className="text-[10px] text-slate-400 mt-0.5">Creator: {l.owner_name}</div>
                          )}
                        </td>

                        <td className="p-4 text-slate-700 dark:text-slate-300">
                          {l.duration_hours} Hours
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {formatAsINR(l.gross_amount_usdc)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            ${l.gross_amount_usdc.toFixed(2)} USDC
                          </div>
                        </td>

                        <td className="p-4 text-[11px] space-y-1">
                          <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            • 85% Creator Payout: ${l.developer_payout_85percent.toFixed(2)} USDC
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            • 10% Platform Protocol Cut: ${l.platform_fee_10percent.toFixed(2)} USDC
                          </div>
                          <div className="text-purple-600 dark:text-purple-400">
                            • 5% DAO Governance Pool: ${l.dao_fee_5percent.toFixed(2)} USDC
                          </div>
                        </td>

                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded text-[10px] font-bold border inline-flex items-center gap-1.5 ${
                              isLocked
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isLocked ? 'Escrow Locked' : 'Settled (85/10/5 Paid)'}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          {isLocked ? (
                            <button
                              onClick={() => handleSettleLease(l.id)}
                              disabled={isSettling}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:opacity-95 transition-opacity flex items-center space-x-1.5 ml-auto disabled:opacity-50"
                              title="Confirm task execution is satisfactory and release 85/10/5 escrow"
                            >
                              {isSettling ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Settling...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Task OK — Release Escrow</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Escrow Settled</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Escrow settlements cryptographically protected on Polygon Amoy.</span>
            <CurrencyDisclaimer />
          </div>
        </div>
      )}

      {/* Interactive Virtual Workspace Terminal Console Modal */}
      {activeLogsAgent && (
        <ExecutionLogsModal
          agent={activeLogsAgent}
          onClose={() => setActiveLogsAgent(null)}
        />
      )}
    </div>
  );
}
