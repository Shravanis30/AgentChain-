'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  ArrowLeft,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ExternalLink,
  Server,
  ShoppingBag,
  Loader2,
  Cpu,
  Terminal,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { ValidatorResult } from '@/components/agents/ValidatorResult';
import { OnChainPublishButton } from '@/components/agents/OnChainPublishButton';

export default function PublishAgentPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [buildData, setBuildData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  const fetchAgentDetails = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAgentDetail(agentId);
      setAgent(data);
      if (data?.status === 'VALIDATED' || data?.status === 'APPROVED' || data?.status === 'PUBLISHED') {
        setIsValidated(true);
      }
      if (data?.status === 'PUBLISHED') {
        setIsPublished(true);
        if (data?.current_version?.onchain_tx_hash) {
          setTxHash(data.current_version.onchain_tx_hash);
        }
      }

      const versionId = data?.current_version_id || data?.current_version?.id;
      if (versionId) {
        try {
          const b = await api.getBuildStatus(agentId, versionId);
          setBuildData(b);
        } catch {
          setBuildData({ status: 'PROMPT_ONLY' });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch agent detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Agents</span>
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Publish Agent Version</span>
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                Validate security assertions & broadcast on-chain marketplace registration
              </p>
            </div>
          </div>

          {agent && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                isPublished
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : isValidated
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              }`}
            >
              {agent.status || 'DRAFT'}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-3 font-mono">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading agent configuration...</p>
        </div>
      ) : agent ? (
        <div className="space-y-6">
          {/* Agent Summary Card */}
          <div className="p-6 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <Bot className="w-5 h-5 text-cyan-500" />
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{agent.name}</h2>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{agent.category}</span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                ${(agent.price_per_call_usdc || 0.05).toFixed(3)} USDC / call
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {agent.description}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between font-mono text-xs text-slate-500 pt-2 gap-2">
              <div className="flex items-center space-x-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-500" />
                <span>
                  {agent.current_version?.model_provider || 'openai'} ({agent.current_version?.model_name || 'gpt-4o'})
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <span>Version: {agent.current_version?.version || 'v1.0.0'}</span>

                {buildData && (
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      buildData.status === 'SUCCEEDED'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : buildData.status === 'BUILDING'
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 animate-pulse'
                        : buildData.status === 'FAILED' || buildData.status === 'BLOCKED_SECRET'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                    }`}
                  >
                    Container Build: {buildData.status}
                  </span>
                )}

                {(agent.current_version_id || agent.current_version?.id) && (
                  <Link
                    href={`/dashboard/agents/${agent.id}/versions/${agent.current_version_id || agent.current_version?.id}/build`}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 transition-colors inline-flex items-center space-x-1"
                  >
                    <Terminal className="w-3 h-3 text-cyan-400" />
                    <span>View Build Console</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Flow Stepper Indicator */}
          <div className="grid grid-cols-2 gap-4 font-mono text-xs">
            <div
              className={`p-4 rounded-2xl border flex items-center space-x-3 ${
                isValidated
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center font-bold">1</div>
              <div>
                <p>Stage 1: Static Validator</p>
                <p className="text-[10px] opacity-70">{isValidated ? 'PASSED' : 'Pending Run'}</p>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border flex items-center space-x-3 ${
                isPublished
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold'
                  : isValidated
                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-600 dark:text-purple-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center font-bold">2</div>
              <div>
                <p>Stage 2: On-Chain Broadcast</p>
                <p className="text-[10px] opacity-70">{isPublished ? 'CONFIRMED ON-CHAIN' : 'Awaiting Stage 1'}</p>
              </div>
            </div>
          </div>

          {/* Stage 1: Static Security Validator */}
          <ValidatorResult
            agentId={agentId}
            onValidated={(passed) => {
              setIsValidated(passed);
            }}
          />

          {/* Stage 2: On-Chain Publish Button */}
          <OnChainPublishButton
            agentId={agentId}
            versionHash={agent.current_version?.version || 'v1.0.0'}
            isValidated={isValidated}
            onPublished={(hash) => {
              setIsPublished(true);
              setTxHash(hash);
            }}
          />

          {/* Next Step Links when Published */}
          {isPublished && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl glass-panel border border-emerald-500/30 bg-emerald-500/5 space-y-4"
            >
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Next Actions for Your Published Agent</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Link
                  href="/dashboard/deploy"
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 transition-all flex items-center space-x-3 text-slate-900 dark:text-white font-bold text-xs"
                >
                  <Server className="w-5 h-5 text-cyan-500 shrink-0" />
                  <div>
                    <p>Deploy to Virtual Workspace</p>
                    <p className="text-[10px] font-mono text-slate-500 font-normal">Provision isolated runtime node</p>
                  </div>
                </Link>

                <Link
                  href="/marketplace"
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500 transition-all flex items-center space-x-3 text-slate-900 dark:text-white font-bold text-xs"
                >
                  <ShoppingBag className="w-5 h-5 text-purple-500 shrink-0" />
                  <div>
                    <p>View in Public Marketplace</p>
                    <p className="text-[10px] font-mono text-slate-500 font-normal">Verify listing in public registry</p>
                  </div>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      ) : null}
    </div>
  );
}
