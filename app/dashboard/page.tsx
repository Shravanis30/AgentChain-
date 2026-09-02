'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Plus, Play, Pause, Terminal, Search, Cpu, FolderOpen, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AgentItem, api } from '@/lib/api-client';

export default function DashboardOverviewPage() {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setIsLoading(true);
    api
      .getMyAgents()
      .then((data) => setAgents(data || []))
      .catch(() => setAgents([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        <Link
          href="/dashboard/deploy"
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity inline-flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Deploy to Virtual Workspace</span>
        </Link>
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
            You have not created any AI agents yet. Click below to deploy your first agent into a virtual workspace.
          </p>
          <Link
            href="/dashboard/deploy"
            className="inline-block px-5 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs border border-cyan-500/30"
          >
            Deploy New Agent Workspace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-md hover:border-cyan-500/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-500">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{agent.name}</h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {agent.category || 'General'}
                    </span>
                  </div>
                </div>

                {/* Status Badges: DRAFT / PUBLISHED / DEPLOYED / RUNNING / STOPPED */}
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {agent.status || 'DEPLOYED'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {agent.description || 'Autonomous AgentChain worker container.'}
              </p>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono text-slate-500">
                <div className="flex items-center space-x-1">
                  <Cpu className="w-3.5 h-3.5 text-purple-500" />
                  <span>{agent.model_provider || 'OpenAI'} ({agent.model_name || 'gpt-4o'})</span>
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  ${(agent.price_per_call_usdc || 15.0).toFixed(2)} / hr
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
