'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  fetchMarketplaceAgents,
  MarketplaceAgent,
  MarketplaceFilterParams,
} from '@/lib/api/marketplace';
import { AgentCard, AgentCardSkeleton } from '@/components/marketplace/AgentCard';
import { FilterBar } from '@/components/marketplace/FilterBar';
import { Bot, ChevronLeft, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';

export default function MarketplacePage() {
  const [filters, setFilters] = useState<MarketplaceFilterParams>({
    category: 'All',
    search: '',
    sort_by: 'newest',
    limit: 9,
    offset: 0,
  });

  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAgents = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchMarketplaceAgents(filters);
      setAgents(res.agents || []);
      setTotal(res.total || res.agents.length);
    } catch (err: any) {
      setErrorMsg('Failed to load marketplace agents. Please check connection and try again.');
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, [filters]);

  const handleResetFilters = () => {
    setFilters({
      category: 'All',
      search: '',
      min_price: undefined,
      max_price: undefined,
      sort_by: 'newest',
      limit: 9,
      offset: 0,
    });
  };

  const totalPages = Math.ceil(total / (filters.limit || 9)) || 1;
  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 9)) + 1;

  return (
    <div className="min-h-screen pt-28 pb-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Page Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 max-w-3xl mx-auto pt-4"
        >
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PUBLIC AGENT REGISTRY</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Autonomous AI Agent Marketplace
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
            Discover, audit, and lease verified AI agent workforces. Every transaction is backed by Solidity smart contract escrow and proof-of-task verification.
          </p>
        </motion.div>

        {/* Filter Controls Bar */}
        <FilterBar
          filters={filters}
          onChange={(newFilters) => setFilters(newFilters)}
          onReset={handleResetFilters}
        />

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Agents Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between font-mono text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing {agents.length} of {total} Published Agents
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="p-16 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-4">
              <Bot className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Agents Match Your Search Criteria
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your category filter, clearing price thresholds, or resetting your search keywords.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              disabled={currentPage <= 1 || isLoading}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  offset: Math.max(0, (prev.offset || 0) - (prev.limit || 9)),
                }))
              }
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 font-mono text-xs font-bold flex items-center space-x-1 hover:border-cyan-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 px-3">
              {currentPage} / {totalPages}
            </span>

            <button
              disabled={currentPage >= totalPages || isLoading}
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  offset: (prev.offset || 0) + (prev.limit || 9),
                }))
              }
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 font-mono text-xs font-bold flex items-center space-x-1 hover:border-cyan-500 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
