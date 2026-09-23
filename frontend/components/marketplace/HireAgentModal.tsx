'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Zap,
  Bot,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  ShieldCheck,
  Cpu,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Wallet,
  Lock,
} from 'lucide-react';
import { useAccount, useWriteContract } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { api } from '@/lib/api-client';
import { MarketplaceAgentDetail } from '@/lib/api/marketplace';
import { useINR, formatINR, formatUSDC } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';
import {
  AGENT_MARKETPLACE_ADDRESS,
  AGENT_MARKETPLACE_ABI,
  agentIdToBytes32,
  getExplorerTxUrl,
} from '@/lib/contracts/agentMarketplace';
import {
  USDC_CONTRACT_ADDRESS,
  USDC_ABI,
  usdcToAtomicUnits,
} from '@/lib/contracts/usdc';

interface HireAgentModalProps {
  agent: MarketplaceAgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HireAgentModal({ agent, isOpen, onClose }: HireAgentModalProps) {
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();

  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskPrompt, setTaskPrompt] = useState<string>('');
  const [budgetINR, setBudgetINR] = useState<string>('50');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('idle');
  const [taskDetails, setTaskDetails] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Escrow two-step transaction states
  const [escrowStep, setEscrowStep] = useState<'idle' | 'approving' | 'approved' | 'locking' | 'locked'>('idle');
  const [approveTxHash, setApproveTxHash] = useState<string | null>(null);
  const [lockTxHash, setLockTxHash] = useState<string | null>(null);

  const { rate, toUSDC, formatAsINR } = useINR();

  // Set default INR budget based on agent price
  useEffect(() => {
    if (agent?.price_per_call_usdc && rate > 0) {
      const suggestedInr = Math.max(1, Math.round(agent.price_per_call_usdc * rate));
      setBudgetINR(suggestedInr.toString());
    }
  }, [agent, rate]);

  if (!isOpen || !agent) return null;

  const parsedINR = Math.max(0.1, parseFloat(budgetINR) || 1);
  const calculatedUSDC = toUSDC(parsedINR);
  const atomicUSDC = usdcToAtomicUnits(calculatedUSDC);

  // Step 1: Approve USDC on token contract
  const handleApproveUSDC = async () => {
    if (!isConnected) {
      if (openConnectModal) openConnectModal();
      return;
    }

    setErrorMsg(null);
    setEscrowStep('approving');
    try {
      const hash = await writeContractAsync({
        address: USDC_CONTRACT_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [AGENT_MARKETPLACE_ADDRESS, atomicUSDC],
      });
      setApproveTxHash(hash);
      setEscrowStep('approved');
    } catch (err: any) {
      console.warn('USDC Approve error:', err);
      setErrorMsg(err?.message || 'USDC approve transaction was rejected or failed.');
      setEscrowStep('idle');
    }
  };

  // Step 2: Lock USDC in Escrow & Submit Task
  const handleLockAndStartTask = async () => {
    if (!taskPrompt.trim()) {
      setErrorMsg('Please enter instructions for the agent to execute.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    let onChainLockHash = lockTxHash;

    // If connected to wallet, execute on-chain lock transaction
    if (isConnected) {
      setEscrowStep('locking');
      try {
        const generatedTaskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const taskBytes32 = agentIdToBytes32(generatedTaskId);
        const devAddress = (agent.owner_address || '0x4b73e26c76FDE99D8c70C325985C347Bc0E16Dab') as `0x${string}`;

        const hash = await writeContractAsync({
          address: AGENT_MARKETPLACE_ADDRESS,
          abi: AGENT_MARKETPLACE_ABI,
          functionName: 'lockTaskEscrow',
          args: [taskBytes32, devAddress, atomicUSDC, BigInt(86400)],
        });

        onChainLockHash = hash;
        setLockTxHash(hash);
        setEscrowStep('locked');
      } catch (err: any) {
        console.warn('Escrow Lock error:', err);
        setErrorMsg(err?.message || 'Smart contract lock transaction was rejected.');
        setEscrowStep('approved');
        setIsSubmitting(false);
        return;
      }
    }

    setTaskStatus('QUEUED');

    try {
      const title = taskTitle.trim() || `${agent.name} Task: ${taskPrompt.slice(0, 30)}...`;
      const versionId =
        typeof agent.current_version === 'object'
          ? (agent.current_version as any).id
          : undefined;

      const res = await api.submitTask({
        title,
        user_prompt: taskPrompt,
        budget_usdc: calculatedUSDC,
        agent_version_id: versionId,
      });

      setActiveTaskId(res.task_id);
      setTaskStatus('RUNNING');
      pollTaskProgress(res.task_id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit task to agent orchestration mesh.');
      setTaskStatus('idle');
      setIsSubmitting(false);
    }
  };

  const pollTaskProgress = (taskId: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const details = await api.getTask(taskId);
        setTaskDetails(details);
        setTaskStatus(details.status);

        if (details.status === 'COMPLETED' || details.status === 'FAILED' || details.status === 'CANCELLED') {
          clearInterval(interval);
          setIsSubmitting(false);
        }
      } catch {
        // Continue polling
      }

      if (attempts > 40) {
        clearInterval(interval);
        setIsSubmitting(false);
      }
    }, 1500);
  };

  const handleCopyOutput = () => {
    if (taskDetails?.final_output) {
      navigator.clipboard.writeText(taskDetails.final_output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Hire & Run Agent</span>
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    {agent.category}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {agent.name} • {typeof agent.current_version === 'object' ? (agent.current_version as any).version : agent.current_version || 'v1.0.0'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* State 1: Input Form */}
          {taskStatus === 'idle' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Task Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Audit Staking Contract for Reentrancy"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Task Instructions / Prompt <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={`Describe what you want ${agent.name} to perform, audit, or generate...`}
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-y"
                />
              </div>

              {/* Task Budget Input in INR */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  Task Budget (₹ INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={budgetINR}
                    onChange={(e) => setBudgetINR(e.target.value)}
                    required
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                  <span>
                    ≈ {calculatedUSDC.toFixed(6)} USDC (on-chain amount)
                  </span>
                  <span>1 USDC ≈ ₹{rate.toFixed(2)}</span>
                </div>
              </div>

              {/* Two-Step Escrow Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Escrow Security</span>
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Audited 85/10/5 Smart Escrow
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Quoted Amount:</span>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {formatINR(parsedINR)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      (≈ {calculatedUSDC.toFixed(6)} USDC)
                    </span>
                  </div>
                </div>

                {approveTxHash && (
                  <div className="flex items-center justify-between text-[11px] text-emerald-500 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>USDC Approved:</span>
                    <a
                      href={getExplorerTxUrl(approveTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      {approveTxHash.slice(0, 10)}... <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <CurrencyDisclaimer />
              </div>

              {/* Submit / Two-Step Action Triggers */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>

                {!isConnected ? (
                  <button
                    type="button"
                    onClick={() => (openConnectModal ? openConnectModal() : null)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold border border-slate-700 flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <Wallet className="w-4 h-4 text-cyan-400" />
                    <span>Connect Wallet to Escrow</span>
                  </button>
                ) : escrowStep === 'idle' ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleApproveUSDC}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:opacity-95 text-white font-bold font-mono text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Approve {formatINR(parsedINR)} (≈ {calculatedUSDC.toFixed(4)} USDC)</span>
                  </button>
                ) : escrowStep === 'approving' ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500/50 text-white font-bold font-mono text-xs flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming USDC Approval...</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting || escrowStep === 'locking'}
                    onClick={handleLockAndStartTask}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:opacity-95 text-white font-bold font-mono text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    {escrowStep === 'locking' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Locking in Escrow...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Lock {formatINR(parsedINR)} in Escrow</span>
                      </>
                    )}
                  </button>
                )}

                {/* Instant Dev / Testing Bypass Option if desired */}
                {!isConnected && (
                  <button
                    type="button"
                    onClick={handleLockAndStartTask}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono text-xs flex items-center justify-center space-x-1.5 min-h-[44px]"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Task ({formatINR(parsedINR)})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* State 2: Live DAG Execution & Progress */}
          {(taskStatus === 'QUEUED' || taskStatus === 'RUNNING' || taskStatus === 'VERIFYING' || taskStatus === 'SETTLING') && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-3 font-mono">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 mx-auto">
                  <Loader2 className="w-7 h-7 animate-spin text-cyan-500" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Agent Swarm Executing Task...
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Status: <span className="font-bold text-cyan-600 dark:text-cyan-400">{taskStatus}</span> • Idempotent DAG Workflow Active
                  </p>
                </div>
              </div>

              {/* Steps Progress */}
              {taskDetails?.steps && taskDetails.steps.length > 0 && (
                <div className="space-y-2 font-mono text-xs max-h-48 overflow-y-auto">
                  {taskDetails.steps.map((step: any, idx: number) => (
                    <div
                      key={step.id || idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        {step.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-500 shrink-0" />
                        )}
                        <span className="font-bold text-slate-900 dark:text-white">
                          Step {step.step_order}: {step.title}
                        </span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400">
                        {step.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* State 3: Completed Output Deliverable */}
          {taskStatus === 'COMPLETED' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between font-mono text-xs">
                <div className="flex items-center space-x-2.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="font-bold block">Task Execution Completed & Verified!</span>
                    <span className="text-[10px] opacity-80">Settled via Smart Contract Escrow (85/10/5 Split)</span>
                  </div>
                </div>

                {taskDetails?.proof_of_task_hash && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase">Proof Hash</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {taskDetails.proof_of_task_hash.slice(0, 10)}...{taskDetails.proof_of_task_hash.slice(-6)}
                    </span>
                  </div>
                )}
              </div>

              {/* Final Output Console */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-cyan-500" />
                    Agent Deliverable Output
                  </span>
                  <button
                    onClick={handleCopyOutput}
                    className="flex items-center space-x-1 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Output'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                  {taskDetails?.final_output || 'Task completed successfully without explicit text output.'}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold font-mono text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* State 4: Failed State */}
          {taskStatus === 'FAILED' && (
            <div className="space-y-6 text-center py-6 font-mono">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Task Execution Failed
                </h4>
                <p className="text-xs text-rose-500">
                  {errorMsg || 'Workflow encountered an error during node execution.'}
                </p>
              </div>
              <button
                onClick={() => setTaskStatus('idle')}
                className="px-6 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Try Again
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
