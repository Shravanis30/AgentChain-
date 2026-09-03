'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  fetchAgentProfile,
  MarketplaceAgentDetail,
} from '@/lib/api/marketplace';
import { StatusIndicator } from '@/components/marketplace/StatusIndicator';
import { ReviewList } from '@/components/marketplace/ReviewList';
import { ReviewForm } from '@/components/marketplace/ReviewForm';
import {
  Bot,
  Star,
  Cpu,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  ArrowLeft,
  DollarSign,
  Terminal,
  ExternalLink,
  Code,
  Share2
} from 'lucide-react';
import Link from 'next/link';

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = (params?.id as string) || '';

  const [agent, setAgent] = useState<MarketplaceAgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [ctaToast, setCtaToast] = useState<boolean>(false);

  const loadProfile = async () => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const data = await fetchAgentProfile(agentId);
      setAgent(data);
    } catch {
      setAgent(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [agentId]);

  const handleCopyOwner = () => {
    if (agent?.owner_address) {
      navigator.clipboard.writeText(agent.owner_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRentWorkspace = () => {
    setCtaToast(true);
    setTimeout(() => {
      setCtaToast(false);
      router.push('/dashboard');
    }, 1200);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 pb-20 bg-slate-50 dark:bg-slate-950 px-4">
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="w-24 h-6 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="w-2/3 h-10 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="w-full h-40 rounded-3xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen pt-32 pb-20 bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-4">
          <Bot className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Agent Not Found</h2>
          <p className="text-xs text-slate-500 font-mono">
            The requested published agent profile does not exist or has been unlisted.
          </p>
          <Link
            href="/marketplace"
            className="inline-block px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-xs border border-cyan-500/30"
          >
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const truncatedOwner = agent.owner_address
    ? `${agent.owner_address.slice(0, 6)}...${agent.owner_address.slice(-4)}`
    : '0x71C7...976F';

  return (
    <div className="min-h-screen pt-28 pb-24 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Back Link */}
        <Link
          href="/marketplace"
          className="inline-flex items-center space-x-1.5 text-xs font-mono text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Marketplace</span>
        </Link>

        {/* Hero Banner Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl relative overflow-hidden"
        >
          {/* Status & Version Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  {agent.category}
                </span>
                <span className="ml-2 text-xs font-mono text-slate-400">
                  {typeof agent.current_version === 'object' ? (agent.current_version as any).version : agent.current_version || 'v1.0.0'}
                </span>
              </div>
            </div>

            <StatusIndicator agentId={agent.id} initialStatus={agent.status} />
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {agent.name}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
              {agent.description}
            </p>
          </div>

          {/* Owner Wallet & Rating Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
            <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
              <span>Owner Wallet:</span>
              <span className="text-slate-900 dark:text-white font-bold">{truncatedOwner}</span>
              <button
                onClick={handleCopyOwner}
                className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                title="Copy Owner Address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center space-x-2 text-amber-500 font-bold">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-sm">{agent.rating ? agent.rating.toFixed(1) : '5.0'}</span>
              <span className="text-slate-400 font-normal">({agent.total_reviews || 0} reviews)</span>
            </div>
          </div>
        </motion.div>

        {/* Two-Column Grid: Details vs Rental CTA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column (2/3): System Specs & Tools */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* System Instructions / Prompt Boundary */}
            <div className="p-6 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                System Instructions & Prompt Boundary
              </h3>
              <div className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs border border-slate-800 leading-relaxed">
                {agent.system_instructions || 'Execute static AST parsing, vulnerability detection, and automated unit test assertion verification inside isolated sandbox workspaces.'}
              </div>
            </div>

            {/* Tool Permissions */}
            <div className="p-6 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                <Code className="w-4 h-4 text-purple-500" />
                Sandbox Tool Permissions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {agent.tool_permissions && agent.tool_permissions.length > 0 ? (
                  agent.tool_permissions.map((tp, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                    >
                      <span className="font-bold text-slate-800 dark:text-slate-200">{tp.tool_name}</span>
                      <div className="flex items-center space-x-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.2 rounded ${tp.network ? 'bg-cyan-500/10 text-cyan-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {tp.network ? 'Network' : 'No-Net'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 font-mono">Standard workspace sandbox permissions enabled.</p>
                )}
              </div>
            </div>

            {/* Reviews Section */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                Verified Buyer Reviews
              </h3>
              <ReviewList
                reviews={agent.reviews || []}
                rating={agent.rating || 5.0}
                totalReviews={agent.total_reviews || 0}
              />
              <ReviewForm agentId={agent.id} onReviewSubmitted={loadProfile} />
            </div>

          </div>

          {/* Right Column (1/3): Pricing & Workspace Rental CTA */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl sticky top-28">
              
              {/* Pricing Display */}
              <div className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 font-mono">WORKSPACE LEASE PRICING</span>
                <div className="text-3xl font-black text-slate-900 dark:text-white font-mono flex items-baseline gap-1">
                  ${agent.price_per_call_usdc.toFixed(2)}
                  <span className="text-xs font-sans text-slate-400 font-normal">USDC / call</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono pt-1">
                  Hourly lease & pay-per-call oracle settlement via Solidity Escrow.
                </p>
              </div>

              {/* Architecture Specs */}
              <div className="space-y-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Model Provider:</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {typeof agent.current_version === 'object'
                      ? (agent.current_version as any).model_provider
                      : agent.model_provider || 'OpenAI'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Model Architecture:</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {typeof agent.current_version === 'object'
                      ? (agent.current_version as any).model_name
                      : agent.model_name || 'gpt-4o'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Escrow Split:</span>
                  <span className="text-emerald-500 font-bold">85% Dev / 10% Stakers</span>
                </div>
              </div>

              {/* CTA Toast Notification */}
              {ctaToast && (
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono text-xs text-center animate-pulse">
                  Redirecting to Workspace Dashboard...
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleRentWorkspace}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 dark:from-cyan-500 dark:via-blue-600 dark:to-purple-600 text-white dark:text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 hover:opacity-95 transition-opacity flex items-center justify-center space-x-2"
              >
                <Zap className="w-4 h-4" />
                <span>Rent This Workspace</span>
              </button>

              <div className="text-[10px] text-slate-400 font-mono text-center">
                Guaranteed by AgentChain Oracle Proof
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
