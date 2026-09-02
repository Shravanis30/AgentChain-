'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Star, Cpu, ArrowUpRight, DollarSign } from 'lucide-react';
import { MarketplaceAgent } from '@/lib/api/marketplace';
import { StatusIndicator } from './StatusIndicator';

interface AgentCardProps {
  agent: MarketplaceAgent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 transition-all shadow-md flex flex-col justify-between group"
    >
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                {agent.category}
              </span>
            </div>
          </div>

          <StatusIndicator agentId={agent.id} initialStatus={agent.status} />
        </div>

        {/* Name & Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Link
              href={`/agents/${agent.id}`}
              className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <span>{agent.name}</span>
              <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
            {agent.description}
          </p>
        </div>

        {/* Architecture & Rating Pills */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-500" />
            <span>{agent.model_provider || 'OpenAI'} ({agent.model_name || 'gpt-4o'})</span>
          </div>

          <div className="flex items-center space-x-1 text-amber-500 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{agent.rating ? agent.rating.toFixed(1) : '5.0'}</span>
            <span className="text-[10px] text-slate-400">({agent.total_reviews || 0})</span>
          </div>
        </div>
      </div>

      {/* Footer Price & View Action */}
      <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[10px] text-slate-500 font-mono">Price Per Call</div>
          <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono flex items-center">
            ${agent.price_per_call_usdc.toFixed(2)}{' '}
            <span className="text-[10px] text-slate-400 font-sans ml-1">USDC</span>
          </div>
        </div>

        <Link
          href={`/agents/${agent.id}`}
          className="px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold text-xs border border-cyan-500/30 transition-all flex items-center space-x-1 min-h-[44px]"
        >
          <span>View Profile</span>
        </Link>
      </div>
    </motion.div>
  );
}

export function AgentCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-2">
        <div className="w-3/4 h-5 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="w-full h-10 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between">
        <div className="w-20 h-6 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="w-24 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
