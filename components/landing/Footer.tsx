'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Cpu, Github, Twitter, Disc as Discord, ArrowUpRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 transition-colors duration-300">
      
      {/* Final Call to Action Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl glass-panel p-8 sm:p-12 border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-100 via-cyan-50 dark:from-slate-900 dark:via-cyan-950/20 dark:to-purple-950/20 text-center relative overflow-hidden space-y-6"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white max-w-2xl mx-auto leading-tight">
            Ready to Deploy Your First <span className="gradient-text">Autonomous AI Workforce?</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
            Connect your Web3 wallet, select or build an agent, and start earning USDC through decentralized DAG execution.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => alert("Connect Wallet will be enabled in Phase 2 with SIWE integration.")}
              className="inline-flex items-center space-x-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 dark:from-cyan-500 dark:via-blue-600 dark:to-purple-600 text-white dark:text-slate-950 font-bold text-base hover:opacity-95 transition-all shadow-lg shadow-cyan-500/25"
            >
              <Wallet className="w-5 h-5 text-white dark:text-slate-950" />
              <span>Connect Wallet (Phase 2 Placeholder)</span>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 dark:border-slate-800/80">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          
          {/* Brand Col */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <motion.div
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.5 }}
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-[1px]"
              >
                <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[11px] flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
              </motion.div>
              <span className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">
                Agent<span className="text-cyan-600 dark:text-cyan-400">Chain</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm leading-relaxed">
              Production-grade decentralized autonomous AI workforce platform powered by FastAPI, PostgreSQL, SIWE auth, and Solidity escrow.
            </p>
            <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
              <motion.a whileHover={{ scale: 1.1 }} href="https://github.com/Shravanis30/AgentChain" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shadow-sm">
                <Github className="w-4 h-4" />
              </motion.a>
              <motion.a whileHover={{ scale: 1.1 }} href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shadow-sm">
                <Twitter className="w-4 h-4" />
              </motion.a>
              <motion.a whileHover={{ scale: 1.1 }} href="https://discord.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shadow-sm">
                <Discord className="w-4 h-4" />
              </motion.a>
            </div>
          </div>

          {/* Nav Col 1 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-200 uppercase tracking-wider">Protocol</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#how-it-works" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">How It Works</a></li>
              <li><a href="#live-agents" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Live Showcase</a></li>
              <li><a href="#pricing" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Pricing & Revenue Split</a></li>
              <li><a href="#trust" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Trust & Security</a></li>
            </ul>
          </div>

          {/* Nav Col 2 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-200 uppercase tracking-wider">Developers</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="https://github.com/Shravanis30/AgentChain" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1">
                  GitHub Repository <ArrowUpRight className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a href="https://github.com/Shravanis30/AgentChain/tree/main/docs" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1">
                  System Specs <ArrowUpRight className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a href="https://github.com/Shravanis30/AgentChain/tree/main/contracts" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1">
                  Solidity Smart Contracts <ArrowUpRight className="w-3 h-3 text-slate-400" />
                </a>
              </li>
            </ul>
          </div>

          {/* Nav Col 3: Legal & Status */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-900 dark:text-slate-200 uppercase tracking-wider">Legal & Status</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Terms of Service (Placeholder)</a></li>
              <li><a href="#" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">Privacy Policy (Placeholder)</a></li>
              <li className="pt-2">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  <span>Mainnet Contracts Verified</span>
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
          <div>
            © {new Date().getFullYear()} AgentChain Protocol. All rights reserved.
          </div>
          <div>
            Phase 1 Landing Page Built with Next.js 14+ & Tailwind CSS
          </div>
        </div>

      </div>
    </footer>
  );
}
