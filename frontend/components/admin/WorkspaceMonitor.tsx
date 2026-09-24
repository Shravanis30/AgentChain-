'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Server, Cpu, HardDrive, AlertTriangle, ShieldOff, Play, Pause, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { api, AdminWorkspace } from '@/lib/api-client';

export function WorkspaceMonitor() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await api.getAdminWorkspaces();
      setWorkspaces(data || []);
    } catch (err) {
      console.warn('Failed to load real admin workspaces:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleForceStop = async (wsId: string) => {
    try {
      await api.stopWorkspace(wsId);
      setToastMessage(`Sent termination SIGKILL signal to container workspace ${wsId}.`);
      setWorkspaces((prev) =>
        prev.map((ws) => (ws.id === wsId ? { ...ws, status: 'STOPPED' } : ws))
      );
    } catch (err: any) {
      setToastMessage(`Failed to stop workspace: ${err.message || 'Unknown error'}`);
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFlagAbusive = (wsId: string) => {
    setToastMessage(`Workspace ${wsId} flagged as abusive for security review.`);
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === wsId ? { ...ws, status: 'FLAGGED' } : ws))
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            Global Workspace Container Monitor
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
            Inspect hardware telemetry & forcibly terminate abusive container instances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchWorkspaces(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            Refresh
          </button>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 w-fit">
            {workspaces.length} ACTIVE CONTAINERS
          </span>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-mono text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl w-full max-w-full">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">Workspace / Agent</th>
              <th className="p-4">Tenant Email</th>
              <th className="p-4">CPU Usage</th>
              <th className="p-4">RAM Allocation</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Admin Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    <span>Loading active container telemetry...</span>
                  </div>
                </td>
              </tr>
            ) : workspaces.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No active container instances found in database.
                </td>
              </tr>
            ) : (
              workspaces.map((ws) => (
                <tr key={ws.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-white">{ws.agentName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{ws.id}</div>
                  </td>

                  <td className="p-4 text-slate-600 dark:text-slate-400">{ws.tenantEmail}</td>

                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${ws.cpuPercent > 80 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                          style={{ width: `${ws.cpuPercent}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{ws.cpuPercent}%</span>
                    </div>
                  </td>

                  <td className="p-4 text-slate-700 dark:text-slate-300">{ws.ramMB} MB</td>

                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        ws.status === 'RUNNING'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                          : ws.status === 'FLAGGED'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {ws.status}
                    </span>
                  </td>

                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleFlagAbusive(ws.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[11px] hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
                    >
                      Flag
                    </button>

                    <button
                      onClick={() => handleForceStop(ws.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold text-[11px] hover:bg-rose-500/20 border border-rose-500/30 transition-colors"
                    >
                      Force Stop
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Global container instances monitored with administrative termination governance.
        </div>
      </div>
    </div>
  );
}
