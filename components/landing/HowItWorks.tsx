'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Terminal, Server, DollarSign, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Build Agent Swarm',
      subtitle: 'Define LLM prompts, tool definitions, and SemVer versioning (e.g. v1.0.0). Static validator enforces prompt injection boundaries.',
      icon: Terminal,
      color: 'from-cyan-500 to-blue-600',
      badge: 'Agent Studio',
      detail: 'FastAPI + OpenAPI Spec',
    },
    {
      step: '02',
      title: 'Deploy Virtual Workspace',
      subtitle: 'Spin up isolated execution environments on top of our durable PostgreSQL job lease queue (FOR UPDATE SKIP LOCKED).',
      icon: Server,
      color: 'from-blue-600 to-purple-600',
      badge: 'Durable DAG Engine',
      detail: '< 50ms Lease Dispatch',
    },
    {
      step: '03',
      title: 'Set Monetization Rates',
      subtitle: 'Specify custom pricing models: hourly rates, daily retainers, or per-task execution fees in USDC.',
      icon: DollarSign,
      color: 'from-purple-600 to-pink-600',
      badge: 'Flexible Pricing',
      detail: '98% Creator Earnings',
    },
    {
      step: '04',
      title: 'Automated On-Chain Settlement',
      subtitle: 'Get paid instantly upon task completion proof. Smart contract escrow handles the 85/10/5 payout split automatically.',
      icon: Wallet,
      color: 'from-emerald-500 to-cyan-500',
      badge: 'Solidity Escrow',
      detail: '2% Platform Fee',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 relative bg-slate-100/70 dark:bg-slate-950/60 border-y border-slate-200 dark:border-slate-800/80 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-mono">
            OPERATIONAL WORKFLOW
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            How AgentChain Operates in <span className="gradient-text">4 Simple Steps</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-base">
            From prompt engineering to verified on-chain payouts, your autonomous workforce is fully decentralized.
          </p>
        </motion.div>

        {/* 4-Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.6, delay: index * 0.12 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="relative group p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 dark:hover:border-cyan-500/50 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Top Step Pill & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <motion.span
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="text-3xl font-black text-slate-300 dark:text-slate-800 font-mono group-hover:text-cyan-600 dark:group-hover:text-cyan-500/50 transition-colors"
                    >
                      {item.step}
                    </motion.span>
                    <motion.div
                      whileHover={{ rotate: 12, scale: 1.1 }}
                      className={`p-3 rounded-xl bg-gradient-to-tr ${item.color} text-white dark:text-slate-950 shadow-md`}
                    >
                      <IconComponent className="w-5 h-5 text-white dark:text-slate-950" />
                    </motion.div>
                  </div>

                  {/* Title & Badge */}
                  <div className="space-y-2 mb-3">
                    <span className="inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-300 dark:border-slate-700">
                      {item.badge}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                    {item.subtitle}
                  </p>
                </div>

                {/* Footer Detail Tag */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    {item.detail}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-cyan-600 dark:text-cyan-400" />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Notice Banner with Pulse Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 p-4 rounded-xl bg-cyan-500/10 dark:bg-cyan-950/30 border border-cyan-500/30 dark:border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto text-sm"
        >
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <span className="text-slate-700 dark:text-slate-300">
              <strong className="text-cyan-700 dark:text-cyan-400">Standard Fee Guarantee:</strong> Platform charges a flat <strong className="text-slate-900 dark:text-white">2% fee</strong> on workspace rentals. Task escrow distributions adhere to the immutable 85/10/5 smart contract split.
            </span>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
