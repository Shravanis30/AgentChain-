'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import {
  User,
  Wallet,
  Lock,
  Check,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Copy,
  GitBranch,
  ArrowRight,
  Sparkles,
  BadgeCheck
} from 'lucide-react';

export default function SettingsPage() {
  const { user, updateProfileName } = useAuth();
  const { address } = useAccount();

  const [fullName, setFullName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const walletAddress =
    address ||
    user?.wallets?.[0]?.wallet_address ||
    (user?.email?.startsWith('0x') ? user.email : null) ||
    'Not Connected';

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user]);

  const handleCopyWallet = () => {
    if (walletAddress && walletAddress !== 'Not Connected') {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = fullName.trim();
    if (!clean || clean.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    if (clean.length > 100) {
      setError('Display name cannot exceed 100 characters.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await updateProfileName(clean);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update name.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <User className="w-6 h-6 text-amber-500" />
            Developer Profile & Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
            Manage your public identity, display name, and Web3 cryptographic credentials
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30 w-fit">
          METAMASK DIRECT AUTH
        </span>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono flex items-center gap-2.5">
          <BadgeCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>Profile display name updated successfully! Visible on Admin Console.</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-mono flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Card 1: Display Name */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Display Name
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Add or update your name. This name represents your account on the platform and is shown to administrators in the Admin Console.
          </p>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400">
              <label htmlFor="displayName" className="font-semibold">
                Developer Full Name
              </label>
              <span>{fullName.length}/100</span>
            </div>
            <input
              id="displayName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Shravani Salunke or Quantum Developer"
              maxLength={100}
              className="w-full px-4 py-3 rounded-xl text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !fullName.trim() || fullName === user?.full_name}
            className="px-6 py-2.5 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Profile Name</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Card 2: MetaMask Identity (Immutable) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-cyan-500" />
              MetaMask Web3 Identity
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Cryptographically verified Ethereum wallet address
            </p>
          </div>

          <span className="px-3 py-1 rounded-xl text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-500" /> Immutable
          </span>
        </div>

        <div className="space-y-2 max-w-xl">
          <label className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Connected Wallet Address
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                readOnly
                value={walletAddress}
                className="w-full px-4 py-3 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 cursor-not-allowed select-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span title="Cryptographically verified via SIWE">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </span>
              </div>
            </div>

            <button
              onClick={handleCopyWallet}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
              title="Copy wallet address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-slate-600 dark:text-slate-400 font-mono text-xs space-y-1">
          <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Why is my MetaMask ID not editable?
          </div>
          <p className="text-[11px] leading-relaxed">
            Your MetaMask address is your immutable cryptographic public key verified on-chain and through EIP-4361 SIWE. It guarantees identity and escrow payouts. You can change your display name anytime above, but your wallet address remains locked to your cryptographic keypair.
          </p>
        </div>
      </div>

      {/* Card 3: Additional Integrations */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              GitHub App Integration
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Connect your repositories for automated agent container builds
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/settings/connected-accounts"
          className="px-4 py-2.5 rounded-xl text-xs font-mono font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center gap-2 w-fit transition-colors"
        >
          <span>Manage GitHub</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
