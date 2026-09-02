'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Star, RefreshCw, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { fetchMarketplaceAgents, MarketplaceAgent } from '@/lib/api/marketplace';

export function LiveAgents() {
  const [loading, setLoading] = useState<boolean>(true);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);

  const categories = ['All', 'Security Audit', 'DeFi & Trading', 'Code Quality', 'Data Mining'];

  const loadRealMarketplace = async () => {
    setLoading(true);
    try {
      const data = await fetchMarketplaceAgents({ limit: 6, category: filterCategory });
      setAgents(data.agents || []);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRealMarketplace();
  }, [filterCategory]);

  return (
    <section id="live-agents" className="py-20 relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header & Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6"
        >
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono">
                LIVE MARKETPLACE REGISTRY
              </h2>
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Autonomous Agents Ready for <span className="gradient-text">Instant Lease</span>
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Rent high-performing agent swarms with zero setup. All task earnings settle via Solidity escrow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/marketplace"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity min-h-[44px]"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>

        {/* Category Filters */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 mb-8 scrollbar-none touch-pan-x">
          {categories.map((cat) => (
            <motion.button
              key={cat}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setFilterCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all min-h-[40px] flex items-center ${
                filterCategory === cat
                  ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </div>

        {/* Grid of Agent Cards */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence mode="popLayout">
            {loading ? (
              // Skeleton Loader Cards (6 items)
              Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={`skel-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl skeleton" />
                    <div className="w-20 h-5 rounded-full skeleton" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-3/4 h-6 rounded skeleton" />
                    <div className="w-1/2 h-4 rounded skeleton" />
                  </div>
                  <div className="w-full h-12 rounded skeleton" />
                  <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="w-24 h-6 rounded skeleton" />
                    <div className="w-20 h-8 rounded-lg skeleton" />
                  </div>
                </motion.div>
              ))
            ) : (
              agents.map((agent, idx) => (
                <motion.div
                  key={agent.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  whileHover={{ y: -6, transition: { duration: 0.2 } }}
                  className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/50 dark:hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-950/10 flex flex-col justify-between group"
                >
                  <div>
                    {/* Top Bar: Icon + Status Pill */}
                    <div className="flex items-center justify-between mb-4">
                      <motion.div
                        whileHover={{ rotate: 15 }}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-600 dark:group-hover:bg-cyan-500 group-hover:text-white dark:group-hover:text-slate-950 transition-colors"
                      >
                        <Bot className="w-5 h-5" />
                      </motion.div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wide bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                        PUBLISHED
                      </span>
                    </div>

                    {/* Name & Version */}
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/agents/${agent.id}`}
                          className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors"
                        >
                          {agent.name}
                        </Link>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {agent.current_version || 'v1.0.0'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono uppercase">
                        {agent.category}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 my-3">
                      {agent.description}
                    </p>
                  </div>

                  {/* Footer Bar: Price & Action */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Lease Price</div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono flex items-center gap-1">
                        ${agent.price_per_call_usdc.toFixed(2)} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">/ call</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-[11px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{agent.rating ? agent.rating.toFixed(1) : '5.0'}</span>
                      </div>
                      <Link
                        href={`/agents/${agent.id}`}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-600 dark:hover:bg-cyan-500 text-cyan-700 dark:text-cyan-400 hover:text-white dark:hover:text-slate-950 font-bold text-xs border border-cyan-500/30 transition-all"
                      >
                        Profile
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </section>
  );
}
