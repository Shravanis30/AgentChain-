'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Cpu, Mail, Lock, LogIn, AlertCircle, Wallet, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPassword, isLoading, error, isAuthenticated, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!email || !password) {
      setFormError('Please enter both email and password.');
      return;
    }

    try {
      await loginWithPassword(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setFormError(err.message || 'Login failed. Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-16 flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-[1px] shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
            <span className="font-bold text-2xl tracking-tight text-slate-900 dark:text-white">
              Agent<span className="text-cyan-600 dark:text-cyan-400">Chain</span>
            </span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Sign In to Your Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Access your autonomous agent swarms and execution ledgers
          </p>
        </div>

        {/* MetaMask / Web3 SIWE Wallet Connect Card */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-3 text-center shadow-md">
          <span className="text-xs font-mono font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider block">
            WEB3 & METAMASK FAST ACCESS
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Connect your MetaMask or Web3 Wallet to authenticate and access your Dashboard
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <ConnectButton />
            <button
              type="button"
              onClick={() => {
                setEmail('admin@agentchain.ai');
                setPassword('admin123');
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-xs font-bold hover:bg-amber-500/20 transition-colors flex items-center space-x-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Fill Admin Credentials</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-slate-300 dark:border-slate-800 w-full" />
          <span className="bg-slate-50 dark:bg-slate-950 px-3 text-[11px] font-mono text-slate-400 uppercase">
            Or Email Authentication
          </span>
        </div>

        {/* Login Form */}
        <div className="p-6 sm:p-8 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          {(formError || error) && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError || error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="creator@agentchain.ai"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 dark:from-cyan-500 dark:via-blue-600 dark:to-purple-600 text-white dark:text-slate-950 font-bold text-sm shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
            </button>
          </form>

          <div className="text-center pt-2 text-xs text-slate-500 font-mono">
            Don't have an account yet?{' '}
            <Link href="/register" className="text-cyan-600 dark:text-cyan-400 font-bold underline hover:text-cyan-500">
              Register Here
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
