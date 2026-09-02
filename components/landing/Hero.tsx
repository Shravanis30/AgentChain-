'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Sparkles, Code2, ShieldCheck, Zap, Network, Activity } from 'lucide-react';

export function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      
      {/* Animated DAG Network Background with Traveling Data Packets */}
      <div className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-40 overflow-hidden">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="dag-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Connected Grid Lines representing DAG workflow */}
          <path id="path1" d="M 100 150 Q 350 80 600 200 T 1100 160" stroke="url(#dag-line)" strokeWidth="2" fill="none" strokeDasharray="6 6" />
          <path id="path2" d="M 200 400 Q 500 320 850 420 T 1300 300" stroke="url(#dag-line)" strokeWidth="2" fill="none" strokeDasharray="4 4" />
          <path d="M 300 200 L 600 200 L 850 420" stroke="url(#dag-line)" strokeWidth="1" fill="none" opacity="0.4" />

          {/* DAG Nodes with Pulse Waves */}
          <circle cx="100" cy="150" r="5" fill="#0284c7" className="animate-ping" style={{ animationDuration: '3s' }} />
          <circle cx="600" cy="200" r="7" fill="#38bdf8" />
          <circle cx="850" cy="420" r="6" fill="#a855f7" />
          <circle cx="1100" cy="160" r="5" fill="#0284c7" />
          <circle cx="300" cy="200" r="5" fill="#818cf8" />
        </svg>

        {/* Ambient Pulsing Glow Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-cyan-500/15 dark:bg-cyan-500/25 rounded-full blur-[130px] pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-purple-600/15 dark:bg-purple-600/25 rounded-full blur-[140px] pointer-events-none"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center max-w-4xl mx-auto space-y-8"
        >
          
          {/* Animated Badge */}
          <motion.div variants={itemVariants} className="inline-block">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-cyan-500/10 dark:bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400 text-xs font-semibold tracking-wide backdrop-blur-md shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Decentralized Multi-Agent Orchestration & Escrow</span>
            </motion.div>
          </motion.div>

          {/* Main Animated Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]"
          >
            Deploy Autonomous <br className="hidden sm:inline" />
            <motion.span
              animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              className="gradient-text bg-[length:200%_auto]"
            >
              AI Workforces
            </motion.span>{' '}
            into Live Workspaces
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={itemVariants}
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed"
          >
            AgentChain pairs durable FastAPI DAG workflow engines with EIP-4361 SIWE authentication and automated 85/10/5 Solidity escrow settlement.
          </motion.p>

          {/* Action CTAs with Hover Animations */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2"
          >
            {/* Primary CTA */}
            <motion.a
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 dark:from-cyan-500 dark:via-blue-600 dark:to-purple-600 text-white dark:text-slate-950 font-bold text-base shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
            >
              <Bot className="w-5 h-5 mr-2 text-white dark:text-slate-950" />
              <span>Launch an Agent</span>
              <ArrowRight className="w-4 h-4 ml-2 text-white dark:text-slate-950" />
            </motion.a>

            {/* Secondary CTA */}
            <motion.a
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              href="#live-agents"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-base border border-slate-300 dark:border-slate-700/80 hover:border-cyan-500/50 transition-all backdrop-blur-md shadow-sm"
            >
              <Code2 className="w-5 h-5 mr-2 text-cyan-600 dark:text-cyan-400" />
              <span>Browse Marketplace</span>
            </motion.a>
          </motion.div>

          {/* Live System Stats Ribbon with Hover Scale */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 border-t border-slate-200 dark:border-slate-800/60 max-w-4xl mx-auto"
          >
            {[
              { label: 'Dev / Stakers / DAO Split', val: '85 / 10 / 5', color: 'text-cyan-600 dark:text-cyan-400' },
              { label: 'Async DAG Leasing', val: '< 50ms', color: 'text-purple-600 dark:text-purple-400' },
              { label: 'Workspace Rentals', val: '2% Fee', color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Audited Execution', val: 'Zero-Mock', color: 'text-amber-600 dark:text-amber-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                whileHover={{ scale: 1.05, y: -3 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="p-4 rounded-xl glass-panel text-center cursor-default"
              >
                <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.val}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
