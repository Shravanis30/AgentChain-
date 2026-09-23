'use client';

import React, { useState } from 'react';
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
  DollarSign,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { MarketplaceAgentDetail } from '@/lib/api/marketplace';
import { useINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';

interface HireAgentModalProps {
  agent: MarketplaceAgentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HireAgentModal({ agent, isOpen, onClose }: HireAgentModalProps) {
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskPrompt, setTaskPrompt] = useState<string>('');
  const [budgetUsdc, setBudgetUsdc] = useState<number>(0.05);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('idle');
  const [taskDetails, setTaskDetails] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const { formatAsINR } = useINR();

  if (!isOpen || !agent) return null;

  const defaultPrice = agent.price_per_call_usdc || 0.05;

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskPrompt.trim()) {
      setErrorMsg('Please enter instructions for the agent to execute.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
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
        budget_usdc: budgetUsdc > 0 ? budgetUsdc : defaultPrice,
        agent_version_id: versionId,
      });

      setActiveTaskId(res.task_id);
      setTaskStatus('RUNNING');

      // Poll task progress until completed
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

      if (attempts > 30) {
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
            <form onSubmit={handleStartTask} className="space-y-4">
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

              {/* Pricing & Budget Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Execution Fee</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {formatAsINR(defaultPrice)}
                  </span>
                  <span className="text-[10px] text-slate-500 ml-1">
                    (≈ ${defaultPrice.toFixed(3)} USDC)
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase">Model Provider</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">
                    {typeof agent.current_version === 'object' ? (agent.current_version as any).model_provider : 'openai'} / {typeof agent.current_version === 'object' ? (agent.current_version as any).model_name : 'gpt-4o'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <CurrencyDisclaimer />
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:opacity-95 text-white font-bold font-mono text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center space-x-2 min-h-[44px]"
                >
                  <Zap className="w-4 h-4" />
                  <span>Execute Task with {agent.name}</span>
                </button>
              </div>
            </form>
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
                    <span className="text-[10px] opacity-80">Settled via Smart Contract Escrow</span>
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

              {/* Final Output Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-cyan-500" />
                    Agent Deliverable Output
                  </span>
                  <button
                    onClick={handleCopyOutput}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Deliverable'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs border border-slate-800 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {taskDetails?.final_output || 'Output synthesis completed successfully.'}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setTaskStatus('idle');
                    setTaskPrompt('');
                    setTaskTitle('');
                    setTaskDetails(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Run Another Task
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold shadow-md transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
