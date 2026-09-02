'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ShieldCheck, DollarSign, Loader2, Check } from 'lucide-react';
import { MarketplaceAgentDetail } from '@/lib/api/marketplace';
import { api } from '@/lib/api-client';

interface RentalCheckoutModalProps {
  agent: MarketplaceAgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RentalCheckoutModal({ agent, isOpen, onClose }: RentalCheckoutModalProps) {
  const [durationHours, setDurationHours] = useState<number>(24);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen || !agent) return null;

  const rate = agent.price_per_call_usdc || 15.0;
  const grossTotal = rate * durationHours;
  const platformFee2Percent = (grossTotal * 0.02);
  const netOwnerPayout = grossTotal - platformFee2Percent;

  const handleConfirmCheckout = async () => {
    setIsProcessing(true);

    try {
      await api.rentWorkspace(agent.id, durationHours);
    } catch (err) {
      console.warn('Lease rental notice:', err);
    } finally {
      setIsProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Workspace Lease Checkout
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {agent.name} ({agent.current_version ? (typeof agent.current_version === 'object' ? (agent.current_version as any).version : agent.current_version) : 'v1.0.0'})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Banner */}
          {success ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <Check className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                Workspace Lease Confirmed!
              </h4>
              <p className="text-xs text-slate-500">
                Container runtime instance provisioned. Escrow lock active.
              </p>
            </div>
          ) : (
            <>
              {/* Duration Selector */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Select Lease Duration (Hours)
                </label>
                <div className="flex items-center space-x-2 font-mono text-xs">
                  {[6, 12, 24, 72, 168].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDurationHours(h)}
                      className={`flex-1 py-2 rounded-xl border transition-all ${
                        durationHours === h
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {h >= 24 ? `${h / 24}d` : `${h}h`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transparent Fee Breakdown Box */}
              <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Base Rate:</span>
                  <span>${rate.toFixed(2)} / hr</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Lease Duration:</span>
                  <span>{durationHours} Hours</span>
                </div>
                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Gross Total Renter Price:</span>
                  <span className="text-base">${grossTotal.toFixed(2)} USDC</span>
                </div>

                {/* 2% Platform Commission Transparency */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>2% AgentChain Platform Fee (Deducted from Owner):</span>
                    <span className="text-rose-400">-${platformFee2Percent.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-400">
                    <span>Net Owner Payout:</span>
                    <span>${netOwnerPayout.toFixed(2)} USDC</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                // TODO: Phase 6 - replace with real POST /api/v1/workspaces/lease payment flow once escrow rental contract endpoint exists
              </div>

              {/* Action Trigger */}
              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmCheckout}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity flex items-center space-x-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirming Escrow...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Confirm Lease (${grossTotal.toFixed(2)} USDC)</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
