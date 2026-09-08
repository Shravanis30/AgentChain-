'use client';

import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { polygonAmoy } from 'wagmi/chains';
import { motion } from 'framer-motion';
import {
  Zap,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Wallet,
  Globe,
  Lock,
  ArrowRightLeft,
  Clock,
} from 'lucide-react';
import {
  AGENT_MARKETPLACE_ADDRESS,
  AGENT_MARKETPLACE_ABI,
  agentIdToBytes32,
  getExplorerTxUrl,
} from '@/lib/contracts/agentMarketplace';
import { api } from '@/lib/api-client';

interface OnChainPublishButtonProps {
  agentId: string;
  versionHash?: string;
  isValidated: boolean;
  isAlreadyPublished?: boolean;
  existingTxHash?: string | null;
  onPublished?: (txHash: string) => void;
}

export function OnChainPublishButton({
  agentId,
  versionHash = 'v1.0.0-sha256-validated',
  isValidated,
  isAlreadyPublished = false,
  existingTxHash = null,
  onPublished,
}: OnChainPublishButtonProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();
  const { openConnectModal } = useConnectModal();

  // Wagmi Write Contract Hook
  const {
    writeContractAsync,
    data: txHashFromWagmi,
    isPending: isWagmiPending,
    error: wagmiWriteError,
    reset: resetWrite,
  } = useWriteContract();

  // Local state tracking
  const [publishStep, setPublishStep] = useState<
    'idle' | 'awaiting_signature' | 'confirming_on_chain' | 'publishing_to_db' | 'confirmed' | 'failed'
  >(isAlreadyPublished && existingTxHash ? 'confirmed' : 'idle');

  const [activeTxHash, setActiveTxHash] = useState<string | null>(existingTxHash || null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize when existing publication data loads asynchronously
  useEffect(() => {
    if (existingTxHash && isAlreadyPublished && publishStep === 'idle') {
      setActiveTxHash(existingTxHash);
      setPublishStep('confirmed');
    }
  }, [existingTxHash, isAlreadyPublished, publishStep]);

  // Wagmi Receipt Wait Hook (only queries when a real transaction hash exists)
  const effectiveHash = (activeTxHash || txHashFromWagmi) as `0x${string}` | undefined;
  const {
    isLoading: isConfirmingOnChain,
    isSuccess: isChainConfirmed,
    data: receiptData,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: effectiveHash,
    chainId: polygonAmoy.id,
  });

  const isCorrectNetwork = chainId === polygonAmoy.id;

  // Track Wagmi pending write state
  useEffect(() => {
    if (isWagmiPending) {
      setPublishStep('awaiting_signature');
    }
  }, [isWagmiPending]);

  // When transaction hash is returned from wallet broadcast
  useEffect(() => {
    if (txHashFromWagmi) {
      setActiveTxHash(txHashFromWagmi);
      setPublishStep('confirming_on_chain');
    }
  }, [txHashFromWagmi]);

  // When transaction receipt is mined and confirmed on Polygon Amoy
  useEffect(() => {
    if (isChainConfirmed && activeTxHash && publishStep === 'confirming_on_chain') {
      const confirmedBlock = Number(receiptData?.blockNumber || 0);
      setBlockNumber(confirmedBlock);
      handleFinalizePublish(activeTxHash, confirmedBlock);
    }
  }, [isChainConfirmed, activeTxHash, receiptData, publishStep]);

  // Handle receipt confirmation errors / reverts
  useEffect(() => {
    if (receiptError && publishStep === 'confirming_on_chain') {
      setPublishStep('failed');
      setErrorMessage(receiptError.message || 'Transaction execution reverted or failed on Polygon Amoy.');
    }
  }, [receiptError, publishStep]);

  // Handle user rejection or broadcast errors
  useEffect(() => {
    if (wagmiWriteError && publishStep !== 'failed') {
      setPublishStep('failed');
      const msg = (wagmiWriteError.message || '').toLowerCase();
      if (msg.includes('user rejected') || msg.includes('denied') || msg.includes('cancelled')) {
        setErrorMessage('Wallet signature was cancelled in your wallet. Click retry to sign again.');
      } else if (msg.includes('insufficient funds') || msg.includes('gas')) {
        setErrorMessage('Insufficient testnet POL for gas fees on Polygon Amoy.');
      } else {
        setErrorMessage(wagmiWriteError.message || 'Transaction broadcast failed.');
      }
    }
  }, [wagmiWriteError, publishStep]);

  const handleFinalizePublish = async (txHash: string, blockNum?: number) => {
    setPublishStep('publishing_to_db');
    try {
      await api.publishAgent(agentId, {
        tx_hash: txHash,
        block_number: blockNum || undefined,
      });
      setPublishStep('confirmed');
      if (onPublished) {
        onPublished(txHash);
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Transaction was confirmed on-chain, but updating database state failed.'
      );
      setPublishStep('failed');
    }
  };

  const handleSwitchToAmoy = async () => {
    try {
      setErrorMessage(null);
      await switchChainAsync({ chainId: polygonAmoy.id });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to switch network to Polygon Amoy.');
    }
  };

  const handleTriggerOnChainPublish = async () => {
    setErrorMessage(null);

    // 1. Enforce active wallet connection
    if (!isConnected) {
      if (openConnectModal) {
        openConnectModal();
      } else {
        setErrorMessage('Please connect a Web3 wallet to publish on-chain.');
      }
      return;
    }

    // 2. Enforce Polygon Amoy Testnet (Chain ID 80002)
    if (!isCorrectNetwork) {
      await handleSwitchToAmoy();
      return;
    }

    setPublishStep('awaiting_signature');
    const formattedBytes32Id = agentIdToBytes32(agentId);
    const developerAddr = (address || '0x0000000000000000000000000000000000000000') as `0x${string}`;

    try {
      const hash = await writeContractAsync({
        address: AGENT_MARKETPLACE_ADDRESS,
        abi: AGENT_MARKETPLACE_ABI,
        functionName: 'registerAgent',
        args: [formattedBytes32Id, versionHash, developerAddr],
      });
      setActiveTxHash(hash);
      setPublishStep('confirming_on_chain');
    } catch (err: any) {
      console.warn('Wagmi write contract error:', err);
      setPublishStep('failed');
      const msg = (err?.shortMessage || err?.message || '').toLowerCase();
      if (msg.includes('user rejected') || msg.includes('denied') || msg.includes('cancelled')) {
        setErrorMessage('Wallet signature was cancelled in your wallet. Click retry to sign again.');
      } else if (msg.includes('insufficient funds') || msg.includes('gas')) {
        setErrorMessage('Insufficient testnet POL for gas fees on Polygon Amoy.');
      } else {
        setErrorMessage(err?.shortMessage || err?.message || 'Transaction broadcast failed.');
      }
    }
  };

  const explorerUrl = activeTxHash ? getExplorerTxUrl(activeTxHash, polygonAmoy.id) : '#';

  return (
    <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">On-Chain Smart Contract Registration</h2>
            <p className="text-xs text-slate-500 font-mono">Register agent identity & version hash to AgentMarketplace.sol</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          {isConnected ? (
            <>
              <span
                className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                  isCorrectNetwork
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                {isCorrectNetwork ? 'Polygon Amoy (80002)' : `Chain ${chainId}`}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openConnectModal?.()}
              className="px-3 py-1 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>

      {/* Validation Shield Guard */}
      {!isValidated && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono flex items-center space-x-3">
          <Lock className="w-5 h-5 shrink-0" />
          <span>Static security validation must pass before publishing on-chain.</span>
        </div>
      )}

      {/* Network Warning Guard */}
      {isConnected && !isCorrectNetwork && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Connected to wrong network. Polygon Amoy Testnet (Chain ID 80002) is required.</span>
          </div>
          <button
            type="button"
            onClick={handleSwitchToAmoy}
            disabled={isSwitchingChain}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-bold flex items-center space-x-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{isSwitchingChain ? 'Switching...' : 'Switch Network'}</span>
          </button>
        </div>
      )}

      {/* Status Alert Panels */}
      {publishStep === 'confirmed' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 space-y-3 font-mono text-xs"
        >
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-sm">Agent Published On-Chain Successfully!</p>
              <p className="text-[11px] opacity-80">
                Transaction mined in block #{blockNumber || 'latest'} on Polygon Amoy. Listing active in public marketplace.
              </p>
            </div>
          </div>

          {activeTxHash && (
            <div className="pt-3 border-t border-emerald-500/20 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="truncate max-w-sm">Tx Hash: {activeTxHash}</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 font-bold text-emerald-500 hover:underline shrink-0"
                >
                  <span>View on Explorer</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 flex items-start space-x-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>PolygonScan Indexing Notice:</strong> Testnet explorers may take 15–30 seconds to index newly mined blocks. If the explorer shows &quot;Transaction Hash not found&quot; immediately, please refresh the page shortly.
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {publishStep === 'failed' && errorMessage && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono space-y-3">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold text-sm">On-Chain Publication Unsuccessful</p>
              <p className="opacity-90">{errorMessage}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-rose-500/20 flex justify-end">
            <button
              onClick={() => {
                setErrorMessage(null);
                setPublishStep('idle');
                if (resetWrite) resetWrite();
              }}
              className="px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold transition-colors flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Transaction</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      {publishStep !== 'confirmed' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-500 font-mono">
            Target Contract: <span className="text-slate-700 dark:text-slate-300 font-bold">{AGENT_MARKETPLACE_ADDRESS.slice(0, 10)}...</span>
          </div>

          {!isConnected ? (
            <button
              type="button"
              onClick={() => openConnectModal?.()}
              disabled={!isValidated}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white font-bold text-sm shadow-xl shadow-purple-500/25 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet to Publish</span>
            </button>
          ) : !isCorrectNetwork ? (
            <button
              type="button"
              onClick={handleSwitchToAmoy}
              disabled={!isValidated || isSwitchingChain}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-sm shadow-xl shadow-amber-500/25 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{isSwitchingChain ? 'Switching Network...' : 'Switch to Polygon Amoy'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTriggerOnChainPublish}
              disabled={
                !isValidated ||
                publishStep === 'awaiting_signature' ||
                publishStep === 'confirming_on_chain' ||
                publishStep === 'publishing_to_db'
              }
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white font-bold text-sm shadow-xl shadow-purple-500/25 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              {publishStep === 'awaiting_signature' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Awaiting Wallet Signature in MetaMask...</span>
                </>
              ) : publishStep === 'confirming_on_chain' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Confirming Transaction on Polygon Amoy...</span>
                </>
              ) : publishStep === 'publishing_to_db' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Syncing Marketplace Registry...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Sign & Publish Agent On-Chain</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
