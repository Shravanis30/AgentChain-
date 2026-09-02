'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, ShieldCheck, Calculator } from 'lucide-react';

export function PricingBlock() {
  const [hourlyRate, setHourlyRate] = useState<number>(25);
  const [activeHours, setActiveHours] = useState<number>(120);

  const grossEarnings = hourlyRate * activeHours;
  const workspaceFee = grossEarnings * 0.02; // 2%
  const netEarnings = grossEarnings - workspaceFee;

  return (
    <section id="pricing" className="py-20 relative bg-slate-100/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800/80 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-mono">
            COMMISSION TRANSPARENCY
          </h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            Literal & Immutable <span className="gradient-text">Economic Model</span>
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-base">
            You set the price. We take 2% on workspace rentals. Task-escrow payouts follow the 85/10/5 protocol split.
          </p>
        </motion.div>

        {/* Pricing Transparency Table & Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Protocol Split Table (7 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 rounded-2xl glass-panel p-6 sm:p-8 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                  Protocol Revenue Distribution Table
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Smart Contract Enforced (`EscrowPayment.sol` Audited)</p>
              </div>
              <motion.span
                whileHover={{ scale: 1.05 }}
                className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30"
              >
                100% On-Chain
              </motion.span>
            </div>

            {/* Protocol Distribution Visual Bar */}
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-xs font-mono font-semibold">
                <span className="text-emerald-600 dark:text-emerald-400">85% Developer</span>
                <span className="text-purple-600 dark:text-purple-400">10% Stakers</span>
                <span className="text-amber-600 dark:text-amber-400">5% DAO</span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '85%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full bg-emerald-500"
                />
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '10%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                  className="h-full bg-purple-500"
                />
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '5%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                  className="h-full bg-amber-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <th className="pb-3 font-semibold">REVENUE STREAM</th>
                    <th className="pb-3 font-semibold">FEE / SPLIT</th>
                    <th className="pb-3 font-semibold">RECIPIENT & PURPOSE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-sm">
                  
                  {/* Row 1: Workspace Rental Fee */}
                  <tr className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      Workspace Rental Fee
                    </td>
                    <td className="py-4 font-mono font-bold text-cyan-700 dark:text-cyan-400">2%</td>
                    <td className="py-4 text-xs text-slate-600 dark:text-slate-300">
                      Platform upkeep, PostgreSQL job queue lease maintenance & API gateway hosting.
                    </td>
                  </tr>

                  {/* Row 2: Creator Task Payout */}
                  <tr className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Developer Task Payout
                    </td>
                    <td className="py-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">85%</td>
                    <td className="py-4 text-xs text-slate-600 dark:text-slate-300">
                      Direct escrow payout to the agent creator wallet upon cryptographic task hash verification (`0x`).
                    </td>
                  </tr>

                  {/* Row 3: Stakers Pool */}
                  <tr className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Staking Rewards Pool
                    </td>
                    <td className="py-4 font-mono font-bold text-purple-700 dark:text-purple-400">10%</td>
                    <td className="py-4 text-xs text-slate-600 dark:text-slate-300">
                      Distributed proportionally to token stakers who secure oracle validation nodes.
                    </td>
                  </tr>

                  {/* Row 4: DAO Treasury */}
                  <tr className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="py-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      DAO Treasury
                    </td>
                    <td className="py-4 font-mono font-bold text-amber-700 dark:text-amber-400">5%</td>
                    <td className="py-4 text-xs text-slate-600 dark:text-slate-300">
                      Governance treasury allocation for community grants, security audits, and ecosystem growth.
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3 shadow-sm">
              <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>No Hidden Surprises:</strong> Unlike traditional AI SaaS platforms charging 20-30% markups, AgentChain operates with a strict 2% platform fee on workspace rentals.
              </span>
            </div>
          </motion.div>

          {/* Interactive Creator Earnings Estimator (5 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 rounded-2xl glass-panel p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Earnings Calculator
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">Monthly Projection</span>
            </div>

            {/* Slider 1: Hourly Rate */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-600 dark:text-slate-400">Agent Price / Hour:</span>
                <span className="text-cyan-700 dark:text-cyan-400 font-bold">${hourlyRate} / hr</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400"
              />
            </div>

            {/* Slider 2: Active Workspace Hours per month */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-600 dark:text-slate-400">Leased Hours / Month:</span>
                <span className="text-purple-700 dark:text-purple-400 font-bold">{activeHours} hrs</span>
              </div>
              <input
                type="range"
                min="10"
                max="500"
                step="10"
                value={activeHours}
                onChange={(e) => setActiveHours(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-600 dark:accent-purple-400"
              />
            </div>

            {/* Projected Output Summary */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span>Gross Revenue:</span>
                <span className="text-slate-900 dark:text-slate-200">${grossEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span>2% Workspace Fee:</span>
                <span className="text-rose-600 dark:text-rose-400">-${workspaceFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Your Net Payout (98%):</span>
                <motion.span
                  key={netEarnings}
                  initial={{ scale: 1.15, color: '#10b981' }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono"
                >
                  ${netEarnings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </motion.span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => alert("Agent deployment studio will open in Phase 4.")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 text-white dark:text-slate-950 font-bold text-sm shadow-lg shadow-purple-950/20 min-h-[44px]"
            >
              Start Monetizing Your Agent
            </motion.button>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
