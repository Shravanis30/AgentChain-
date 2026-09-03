'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Plus, Play, Pause, Terminal, Search, Cpu, FolderOpen, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AgentItem, api } from '@/lib/api-client';

export default function DashboardOverviewPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [buildStatuses, setBuildStatuses] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsLoading(true);
    api
      .getMyAgents()
      .then(async (data) => {
        setAgents(data || []);
        if (data && data.length > 0) {
          const statusMap: Record<string, any> = {};
          await Promise.all(
            data.map(async (ag) => {
              const vId = ag.current_version_id || ag.current_version;
              if (vId) {
                try {
                  const b = await api.getBuildStatus(ag.id, vId);
                  statusMap[ag.id] = b;
                } catch {
                  statusMap[ag.id] = { status: 'PROMPT_ONLY' };
                }
              }
            })
          );
          setBuildStatuses(statusMap);
        }
      })
      .catch(() => setAgents([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBuildBadge = (buildInfo: any) => {
    if (!buildInfo || !buildInfo.status || buildInfo.status === 'PROMPT_ONLY') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/10 text-slate-400 border border-slate-500/30">
          PROMPT_ONLY
        </span>
      );
    }

    const st = buildInfo.status;
    if (st === 'SUCCEEDED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          BUILD: SUCCEEDED
        </span>
      );
    }
    if (st === 'BUILDING') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 animate-pulse">
          BUILD: BUILDING...
        </span>
      );
    }
    if (st === 'BLOCKED_SECRET' || st === 'FAILED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          BUILD: {st}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
        BUILD: {st}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-cyan-500" />
            My Owned AI Agents
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            Manage, publish, and inspect your created agent containers
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/agents/new"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Agent</span>
          </Link>

          <Link
            href="/dashboard/deploy"
            className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors inline-flex items-center space-x-2"
          >
            <Terminal className="w-4 h-4" />
            <span>Deploy Workspace</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter owned agents..."
          className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
      </div>

      {/* Agents List / Grid */}
      {isLoading ? (
        <div className="p-12 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-500">Fetching owned agents from database...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="p-12 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <FolderOpen className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No Owned Agents Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You have not created any AI agents yet. Click below to create your first autonomous AI agent.
          </p>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Agent</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAgents.map((agent) => {
            const buildInfo = buildStatuses[agent.id];
            const versionId = agent.current_version_id || 'v1.0.0';
            return (
              <div
                key={agent.id}
                className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-md hover:border-cyan-500/50 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-500">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{agent.name}</h3>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {agent.category || 'General'}
                          </span>
                          {renderBuildBadge(buildInfo)}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        agent.status === 'PUBLISHED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : agent.status === 'VALIDATED'
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {agent.status || 'DRAFT'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {agent.description || 'Autonomous AgentChain worker container.'}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                      <Cpu className="w-3.5 h-3.5 text-purple-500" />
                      <span>{agent.model_provider || 'OpenAI'} ({agent.model_name || 'gpt-4o'})</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      ${(agent.price_per_call_usdc || 0.05).toFixed(3)} / call
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1">
                    {(agent.current_version_id || agent.current_version) && (
                      <Link
                        href={`/dashboard/agents/${agent.id}/versions/${versionId}/build`}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 transition-colors inline-flex items-center space-x-1"
                      >
                        <Terminal className="w-3 h-3 text-cyan-400" />
                        <span>Build Logs</span>
                      </Link>
                    )}

                    <Link
                      href={`/dashboard/agents/${agent.id}/publish`}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold hover:bg-cyan-500/20 transition-colors border border-cyan-500/20 text-[11px]"
                    >
                      Publish On-Chain
                    </Link>

                    <Link
                      href="/dashboard/deploy"
                      className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-500/20 transition-colors border border-purple-500/20 text-[11px]"
                    >
                      Deploy Workspace
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
