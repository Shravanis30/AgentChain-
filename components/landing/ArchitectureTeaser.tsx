'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Database, Cpu, ShieldCheck, FileText, Network } from 'lucide-react';

export function ArchitectureTeaser() {
  const nodeLayers = [
    {
      title: 'FastAPI Gateway Layer',
      tech: 'Python 3.14 / Uvicorn',
      desc: 'SIWE Cryptographic Auth, Idempotency Deduplication, Non-blocking task submission (< 50ms).',
      icon: Network,
      color: 'border-cyan-500/50 text-cyan-600 dark:text-cyan-400',
    },
    {
      title: 'PostgreSQL DB & Lease Queue',
      tech: 'SQLAlchemy 2.0 / Alembic',
      desc: 'FOR UPDATE SKIP LOCKED atomic job leases, Kahn\'s topological DAG cycle validation.',
      icon: Database,
      color: 'border-blue-500/50 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Worker Pool Daemons',
      tech: 'Durable Async Queue',
      desc: 'Heartbeats, exponential backoff retries, pinned agent semver execution.',
      icon: Cpu,
      color: 'border-purple-500/50 text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Settlement & LLM Layer',
      tech: 'Solidity / OpenAI & Anthropic',
      desc: 'USDC smart contract escrow oracle with two-phase proof-of-task settlement.',
      icon: ShieldCheck,
      color: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400',
    },
  ];

  return (
    <section id="architecture" className="py-20 relative bg-slate-100/90 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 font-mono">
            ENTERPRISE ARCHITECTURE
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Under the Hood: <span className="gradient-text">Engine Architecture</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Designed for non-blocking performance, durable leasing, and deterministic smart contract settlement.
          </p>
        </motion.div>

        {/* Architecture Pipeline Visualizer */}
        <div className="relative max-w-5xl mx-auto">
          {/* Animated Connecting Energy Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 -translate-y-1/2 opacity-30 z-0" />
          
          <motion.div
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
            className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent -translate-y-1/2 z-0 opacity-70"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {nodeLayers.map((layer, index) => {
              const IconComp = layer.icon;
              return (
                <motion.div
                  key={layer.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.12 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className={`p-6 rounded-2xl glass-panel border ${layer.color} hover:shadow-xl transition-all flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                        LAYER 0{index + 1}
                      </span>
                      <IconComp className="w-5 h-5" />
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {layer.title}
                    </h3>
                    
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-800">
                      {layer.tech}
                    </span>

                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
                      {layer.desc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                    <span>Verified</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold">Active</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Documentation Link CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <motion.a
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            href="https://github.com/Shravanis30/AgentChain/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-purple-500/40 transition-all shadow-sm"
          >
            <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Read Full Architecture Documentation</span>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </motion.a>
        </motion.div>

      </div>
    </section>
  );
}
