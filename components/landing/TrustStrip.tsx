'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Cpu, FileCode2, CheckCircle2, ShieldAlert } from 'lucide-react';

export function TrustStrip() {
  const trustFeatures = [
    {
      icon: Lock,
      title: 'SIWE Cryptographic Auth',
      badge: 'EIP-4361 Standard',
      description: 'Sign-In with Ethereum auth backed by single-use Redis 300s TTL nonces (`GETDEL`) preventing replay attacks.',
      color: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      icon: ShieldCheck,
      title: 'On-Chain Smart Escrow',
      badge: 'Solidity 0.8.20',
      description: 'Automated 2-phase settlement oracle (`backend/blockchain/oracle.py`) locking funds in USDC escrow until proof verification.',
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      icon: Cpu,
      title: 'Strict Zero-Mock Policy',
      badge: 'Real LLM Execution',
      description: 'No fake LLM responses or simulated transaction hashes. Production OpenAI & Anthropic executions with exact server token cost logs.',
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: FileCode2,
      title: 'Durable DAG Leasing',
      badge: 'PostgreSQL SKIP LOCKED',
      description: 'Atomic job leasing queue with Kahn\'s algorithm cycle detection preventing deadlock loops in complex agent swarms.',
      color: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <section id="trust" className="py-20 relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono">
            SECURITY & TRUST GUARANTEES
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Built for Enterprise-Grade <span className="gradient-text">Trust & Transparency</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Every layer of AgentChain is cryptographically signed, audited, and deterministic.
          </p>
        </motion.div>

        {/* 4 Trust Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustFeatures.map((item, index) => {
            const IconComp = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800/90 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 10 }}
                      className={`p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${item.color}`}
                    >
                      <IconComp className="w-6 h-6" />
                    </motion.div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center text-[11px] font-mono text-emerald-600 dark:text-emerald-400 gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Audited Contract</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Contract & Repo Audit Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Smart Contract Escrow Address</h4>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                `0x8F3a2...4B21` (USDC Settlement Pool on Sepolia/Mainnet)
              </p>
            </div>
          </div>

          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="https://github.com/Shravanis30/AgentChain"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-mono font-bold text-cyan-700 dark:text-cyan-400 border border-slate-300 dark:border-slate-700 transition-colors whitespace-nowrap shadow-sm"
          >
            Inspect GitHub Source →
          </motion.a>
        </motion.div>

      </div>
    </section>
  );
}
