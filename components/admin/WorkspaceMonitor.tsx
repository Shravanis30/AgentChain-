'use client';

import React, { useState } from 'react';
import { Server, Cpu, HardDrive, AlertTriangle, ShieldOff, Play, Pause, AlertCircle } from 'lucide-react';

interface GlobalWorkspace {
  id: string;
  agentName: string;
  tenantEmail: string;
  cpuPercent: number;
  ramMB: number;
  uptimeHours: number;
  status: 'RUNNING' | 'FLAGGED' | 'STOPPED';
}

const MOCK_GLOBAL_WORKSPACES: GlobalWorkspace[] = [
  {
    id: 'ws-8941',
    agentName: 'Solidity Guard Sentinel',
    tenantEmail: 'trader.eth@polygon.org',
    cpuPercent: 34,
    ramMB: 2450,
    uptimeHours: 142,
    status: 'RUNNING',
  },
  {
    id: 'ws-7712',
    agentName: 'Quant DAG Arbitrageur',
    tenantEmail: 'dev.quantum@solidity.io',
    cpuPercent: 88,
    ramMB: 6120,
    uptimeHours: 98,
    status: 'RUNNING',
  },
  {
    id: 'ws-9011',
    agentName: 'Web Scraper Spammer',
    tenantEmail: 'spammer@tempmail.com',
    cpuPercent: 99,
    ramMB: 7890,
    uptimeHours: 12,
    status: 'FLAGGED',
  },
];

export function WorkspaceMonitor() {
  const [workspaces, setWorkspaces] = useState<GlobalWorkspace[]>(MOCK_GLOBAL_WORKSPACES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleForceStop = (wsId: string) => {
    setToastMessage(`Sent termination SIGKILL signal to container workspace ${wsId}.`);
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === wsId ? { ...ws, status: 'STOPPED' } : ws))
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFlagAbusive = (wsId: string) => {
    setToastMessage(`Workspace ${wsId} flagged as abusive for review.`);
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === wsId ? { ...ws, status: 'FLAGGED' } : ws))
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-amber-500" />
            Global Workspace Container Monitor
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            Inspect hardware telemetry & forcibly terminate abusive container instances
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/10 text-amber-500 font-bold border border-amber-500/30">
          {workspaces.length} ACTIVE CONTAINERS
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
              <th className="p-4">Workspace / Agent</th>
              <th className="p-4">Tenant Email</th>
              <th className="p-4">CPU Usage</th>
              <th className="p-4">RAM Allocation</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Admin Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {workspaces.map((ws) => (
              <tr key={ws.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="p-4">
                  <div className="font-bold text-slate-900 dark:text-white">{ws.agentName}</div>
                  <div className="text-[10px] text-slate-400">{ws.id}</div>
                </td>

                <td className="p-4 text-slate-400">{ws.tenantEmail}</td>

                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${ws.cpuPercent > 80 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: `${ws.cpuPercent}%` }}
                      />
                    </div>
                    <span className="font-bold">{ws.cpuPercent}%</span>
                  </div>
                </td>

                <td className="p-4">{ws.ramMB} MB</td>

                <td className="p-4">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ws.status === 'RUNNING'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : ws.status === 'FLAGGED'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {ws.status}
                  </span>
                </td>

                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleFlagAbusive(ws.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 font-bold text-[11px] hover:bg-amber-500/20 transition-colors"
                  >
                    Flag
                  </button>

                  <button
                    onClick={() => handleForceStop(ws.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 font-bold text-[11px] hover:bg-rose-500/30 transition-colors"
                  >
                    Force Stop
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="p-4 bg-slate-100 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-400">
          Global container instances monitored with administrative termination governance.
        </div>
      </div>
    </div>
  );
}
