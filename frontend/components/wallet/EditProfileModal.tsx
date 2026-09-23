'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { X, User, Lock, Wallet, Check, AlertCircle, Loader2, Sparkles, ShieldCheck } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress?: string | null;
}

export function EditProfileModal({ isOpen, onClose, walletAddress }: EditProfileModalProps) {
  const { user, updateProfileName } = useAuth();
  const [fullName, setFullName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setFullName(user?.full_name || '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const currentWallet = walletAddress || user?.wallets?.[0]?.wallet_address || 'Not Linked';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (cleanName.length > 100) {
      setError('Name cannot exceed 100 characters.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await updateProfileName(cleanName);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Failed to update name.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Developer Profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Visible on Platform & Admin Console
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Success Notification */}
          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Name updated successfully! Visible on Admin Dashboard.</span>
            </div>
          )}

          {/* Error Notification */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Field 1: Immutable MetaMask Wallet ID */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-cyan-500" />
                MetaMask Wallet Address
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-mono">
                <Lock className="w-3 h-3" /> Immutable
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={currentWallet}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 cursor-not-allowed select-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span title="Cryptographically verified">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Your MetaMask ID is verified via SIWE signature and cannot be modified.
            </p>
          </div>

          {/* Field 2: Editable Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500" />
                Developer / Display Name
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {fullName.length}/100
              </span>
            </label>
            <input
              type="text"
              autoFocus
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Shravani Salunke or Quantum Developer"
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all shadow-sm"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              This name will be displayed in the Navbar and in the Admin Console User Directory.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving || success || !fullName.trim()}
              className="px-5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save Name</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
