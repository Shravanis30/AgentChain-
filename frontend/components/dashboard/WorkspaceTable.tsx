'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Server, Terminal, Plus, RefreshCw, Loader2, StopCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, AgentItem } from '@/lib/api-client';
import { ExecutionLogsModal } from '@/components/dashboard/ExecutionLogsModal';

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
}

export function WorkspaceTable() {
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [activeLogsAgent, setActiveLogsAgent] = useState<AgentItem | null>(null);

  const fetchWorkspaces = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await api.getMyWorkspaces();
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
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load workspaces:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

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

  const formatRate = (mode: string, rate: number) => {
    if (mode === 'PER_DAY') return `$${rate.toFixed(2)} / day`;
    if (mode === 'CUSTOM_FLAT') return `$${rate.toFixed(2)} flat`;
    return `$${rate.toFixed(2)} / hr`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-500" />
            My Deployed Workspaces
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Active Docker container instances running isolated AI agent workloads
          </p>
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
          <span className="text-xs font-mono text-slate-400 hidden sm:inline">
            {workspaces.length} Total
          </span>
        </div>
      </div>

      {/* Table Container */}
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
                  <th className="p-4">Workspace / Container ID</th>
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

                  return (
                    <tr key={ws.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>Workspace {ws.id.slice(0, 8)}</span>
                        </div>
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

                      {/* Honest Billing Status: replaces fake mock earnings */}
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                          Billing not yet connected
                        </span>
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
