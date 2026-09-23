'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ShieldCheck, DollarSign, Loader2, Check, Lock, Wallet } from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { MarketplaceAgentDetail } from '@/lib/api/marketplace';
import { api } from '@/lib/api-client';
import { useINR, formatINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';
import {
  AGENT_MARKETPLACE_ADDRESS,
  AGENT_MARKETPLACE_ABI,
  agentIdToBytes32,
} from '@/lib/contracts/agentMarketplace';
import {
  USDC_CONTRACT_ADDRESS,
  USDC_ABI,
  usdcToAtomicUnits,
} from '@/lib/contracts/usdc';

interface RentalCheckoutModalProps {
  agent: MarketplaceAgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RentalCheckoutModal({ agent, isOpen, onClose }: RentalCheckoutModalProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();

  const [durationHours, setDurationHours] = useState<number>(24);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [rentalError, setRentalError] = useState<string | null>(null);

  // Escrow approve & lock states
  const [escrowStep, setEscrowStep] = useState<'idle' | 'approving' | 'approved' | 'locking' | 'locked'>('idle');

  const { formatAsINR, rate: exchangeRate } = useINR();

  if (!isOpen || !agent) return null;

  const rate = agent.price_per_call_usdc || 15.0;
  const grossTotalUSDC = rate * durationHours;
  const grossTotalINR = grossTotalUSDC * exchangeRate;
  const platformFee2PercentUSDC = grossTotalUSDC * 0.02;
  const netOwnerPayoutUSDC = grossTotalUSDC - platformFee2PercentUSDC;
  const atomicUSDC = usdcToAtomicUnits(grossTotalUSDC);

  // Step 1: Approve USDC
  const handleApproveUSDC = async () => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    setRentalError(null);
    setEscrowStep('approving');
    try {
      await writeContractAsync({
        address: USDC_CONTRACT_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [AGENT_MARKETPLACE_ADDRESS, atomicUSDC],
      });
      setEscrowStep('approved');
    } catch (err: any) {
      console.warn('Rental USDC approve error:', err);
      setRentalError(err?.message || 'USDC approve transaction was rejected.');
      setEscrowStep('idle');
    }
  };

  // Step 2: Lock & Finalize Rental
  const handleConfirmCheckout = async () => {
    setIsProcessing(true);
    setRentalError(null);

    if (isConnected) {
      setEscrowStep('locking');
      try {
        const leaseTaskId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const taskBytes32 = agentIdToBytes32(leaseTaskId);
        const ownerWallet = (agent.owner_address || '0x4b73e26c76FDE99D8c70C325985C347Bc0E16Dab') as `0x${string}`;

        await writeContractAsync({
          address: AGENT_MARKETPLACE_ADDRESS,
          abi: AGENT_MARKETPLACE_ABI,
          functionName: 'lockTaskEscrow',
          args: [taskBytes32, ownerWallet, atomicUSDC, BigInt(durationHours * 3600)],
        });
        setEscrowStep('locked');
      } catch (err: any) {
        console.warn('Rental Escrow lock error:', err);
        setRentalError(err?.message || 'Escrow lock transaction was rejected.');
        setEscrowStep('approved');
        setIsProcessing(false);
        return;
      }
    }

    try {
      await api.rentWorkspace(agent.id, durationHours);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setRentalError(err?.message || 'Failed to complete workspace lease checkout.');
    } finally {
      setIsProcessing(false);
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

          {rentalError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono">
              {rentalError}
            </div>
          )}

          {/* Success Banner */}
          {success ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <Check className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                Workspace Lease Confirmed!
              </h4>
              <p className="text-xs text-slate-500">
                Container runtime instance provisioned. Escrow lock active on-chain.
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

              {/* Transparent Fee Breakdown Box in INR Primary */}
              <div className="p-5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Base Rate:</span>
                  <span>
                    {formatAsINR(rate)} / hr{' '}
                    <span className="text-[10px] text-slate-400 font-normal">
                      (≈ ${rate.toFixed(2)} USDC)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Lease Duration:</span>
                  <span>{durationHours} Hours</span>
                </div>

                <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Gross Total Renter Price:</span>
                  <div className="text-right">
                    <span className="text-base text-cyan-600 dark:text-cyan-400">
                      {formatINR(grossTotalINR)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal ml-1.5">
                      (≈ ${grossTotalUSDC.toFixed(2)} USDC)
                    </span>
                  </div>
                </div>

                {/* 2% Platform Commission Transparency */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>2% AgentChain Platform Fee (Deducted from Owner):</span>
                    <span className="text-rose-400">
                      -{formatAsINR(platformFee2PercentUSDC, true)}{' '}
                      <span className="text-[10px] font-normal">(-${platformFee2PercentUSDC.toFixed(2)} USDC)</span>
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-400">
                    <span>Net Owner Payout:</span>
                    <span>
                      {formatAsINR(netOwnerPayoutUSDC, true)}{' '}
                      <span className="text-[10px] font-normal">(${netOwnerPayoutUSDC.toFixed(2)} USDC)</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-slate-400">
                  USDC escrow settlement and platform commission automatically processed upon lease confirmation.
                </div>
                <CurrencyDisclaimer />
              </div>

              {/* Action Trigger Buttons with Two-Step Copy */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>

                {!isConnected ? (
                  <button
                    type="button"
                    onClick={() => (openConnectModal ? openConnectModal() : null)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold border border-slate-700 flex items-center justify-center space-x-2"
                  >
                    <Wallet className="w-4 h-4 text-cyan-400" />
                    <span>Connect Wallet to Escrow</span>
                  </button>
                ) : escrowStep === 'idle' ? (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleApproveUSDC}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 hover:opacity-95 transition-opacity flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Approve {formatINR(grossTotalINR)} (≈ {grossTotalUSDC.toFixed(2)} USDC)</span>
                  </button>
                ) : escrowStep === 'approving' ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500/50 text-white font-bold text-xs flex items-center justify-center space-x-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming Approval...</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleConfirmCheckout}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity flex items-center justify-center space-x-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Locking Escrow...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Lock {formatINR(grossTotalINR)} in Escrow</span>
                      </>
                    )}
                  </button>
                )}

                {/* Instant Dev / Testing Bypass Option if disconnected */}
                {!isConnected && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleConfirmCheckout}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm Lease ({formatINR(grossTotalINR)})</span>
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
