'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  Terminal,
  GitBranch,
  Sparkles,
  Loader2,
  AlertCircle,
  Code2,
  Wrench,
  DollarSign,
  Layers,
  FileText,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface CreateAgentFormProps {
  onCreated?: (agentId: string) => void;
}

export function CreateAgentForm({ onCreated }: CreateAgentFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInstalledRedirect = searchParams.get('installed') === 'true';
  const isRepoModeRequested = searchParams.get('mode') === 'repo' || isInstalledRedirect;

  // Basic Details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('security');
  const [tags, setTags] = useState('audit, solidity, security');
  const [pricingModel, setPricingModel] = useState('pay_per_call');
  const [pricePerCall, setPricePerCall] = useState('0.05');

  // Agent Mode: PROMPT_CONFIGURED vs REPO_BACKED
  const [agentMode, setAgentMode] = useState<'PROMPT_CONFIGURED' | 'REPO_BACKED'>(
    isRepoModeRequested ? 'REPO_BACKED' : 'PROMPT_CONFIGURED'
  );

  // Prompt Configuration
  const [systemInstructions, setSystemInstructions] = useState(
    'You are an autonomous security analysis agent designed to audit Solidity smart contracts, scan AST structures for reentrancy vulnerabilities, and output structured security reports.'
  );
  const [modelProvider, setModelProvider] = useState('openai');
  const [modelName, setModelName] = useState('gpt-4o');
  const [temperature, setTemperature] = useState('0.7');
  const [maxTokens, setMaxTokens] = useState('4096');

  // Tool Permissions
  const [tools, setTools] = useState({
    web_search: true,
    code_execution: true,
    shell_access: false,
    file_io: true,
  });

  // GitHub Repo Configuration (for REPO_BACKED mode)
  const [gitHubRepos, setGitHubRepos] = useState<any[]>([]);
  const [hasGitHubAccess, setHasGitHubAccess] = useState<boolean>(false);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [isCustomRepoInput, setIsCustomRepoInput] = useState(false);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);

  useEffect(() => {
    // Check GitHub connection availability for current logged in user
    api
      .getGitHubRepos()
      .then((data: any) => {
        if (data && data.connected && Array.isArray(data.repos) && data.repos.length > 0) {
          setGitHubRepos(data.repos);
          setHasGitHubAccess(true);
          setSelectedRepo(data.repos[0]?.full_name || '');
          if (isRepoModeRequested) {
            setAgentMode('REPO_BACKED');
          }
        } else {
          setHasGitHubAccess(false);
          setGitHubRepos([]);
        }
      })
      .catch(() => {
        setHasGitHubAccess(false);
        setGitHubRepos([]);
      });
  }, [isRepoModeRequested]);

  const handleConnectGitHubInline = async () => {
    setIsConnectingGitHub(true);
    setError(null);
    try {
      const res = await api.getGitHubInstallUrl('/dashboard/agents/new?mode=repo');
      if (res.install_url) {
        window.location.href = res.install_url;
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate GitHub App connection.');
      setIsConnectingGitHub(false);
    }
  };

  const handleConnectDevGitHubInline = async () => {
    setIsConnectingGitHub(true);
    setError(null);
    try {
      await api.connectDevGitHub();
      const data = await api.getGitHubRepos();
      if (data && data.connected && Array.isArray(data.repos) && data.repos.length > 0) {
        setGitHubRepos(data.repos);
        setHasGitHubAccess(true);
        setSelectedRepo(data.repos[0]?.full_name || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect dev GitHub account.');
    } finally {
      setIsConnectingGitHub(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Agent name is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    if (agentMode === 'REPO_BACKED' && !hasGitHubAccess) {
      setError('GitHub connection required to deploy a repository-backed agent.');
      return;
    }

    setIsSubmitting(true);

    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      const parsedPrice = parseFloat(pricePerCall) || 0.05;

      const toolPermissionsList = [
        {
          tool_name: 'web_search',
          network_enabled: tools.web_search,
          shell_enabled: false,
          filesystem_read: true,
          filesystem_write: false,
        },
        {
          tool_name: 'code_execution',
          network_enabled: false,
          shell_enabled: tools.shell_access,
          filesystem_read: true,
          filesystem_write: tools.file_io,
        },
      ];

      const selectedRepoObj = gitHubRepos.find((r) => r.full_name === selectedRepo);

      const payload = {
        name,
        slug: slug || `agent-${Date.now()}`,
        description,
        category,
        price_per_call_usdc: parsedPrice,
        pricing_model: pricingModel,
        initial_version: {
          version: 'v1.0.0',
          system_instructions: systemInstructions,
          model_provider: modelProvider,
          model_name: modelName,
          temperature: parseFloat(temperature) || 0.7,
          max_tokens: parseInt(maxTokens) || 4096,
          source_type: agentMode === 'REPO_BACKED' ? 'REPO_BACKED' : 'PROMPT_ONLY',
          source_repo: agentMode === 'REPO_BACKED' ? selectedRepo : undefined,
          source_ref: agentMode === 'REPO_BACKED' ? selectedBranch : undefined,
          installation_id: agentMode === 'REPO_BACKED' ? selectedRepoObj?.installation_id : undefined,
        },
        tool_permissions: toolPermissionsList,
      };

      const result = await api.createAgent(payload);

      const agentId = result.agent_id || (result as any).id;
      if (onCreated) {
        onCreated(agentId);
      } else {
        router.push(`/dashboard/agents/${agentId}/publish`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create agent draft. Please check inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error Alert */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center space-x-3"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* 1. Basic Information */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Basic Agent Metadata</h2>
            <p className="text-xs text-slate-500 font-mono">Define identity, category, and billing tier</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Agent Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Solidity Sentinel Auditor"
              required
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <option value="security">Security Audit & AST Scanning</option>
              <option value="defi">DeFi & Arbitrage Execution</option>
              <option value="data_mining">Data Extraction & Parsing</option>
              <option value="code_quality">Code Quality & Review</option>
              <option value="research">Research & Knowledge Graph</option>
              <option value="general">General Autonomous Assistant</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
            Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe what your AI agent does, its specialization, and execution guarantees..."
            required
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Price Per Call (USDC)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="0.001"
                min="0.0001"
                value={pricePerCall}
                onChange={(e) => setPricePerCall(e.target.value)}
                required
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="security, reentrancy, eth"
              className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>
      </div>

      {/* 2. Architecture & Mode Selection */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Agent Architecture Mode</h2>
            <p className="text-xs text-slate-500 font-mono">Choose prompt-based instructions or GitHub repository integration</p>
          </div>
        </div>

        {/* Mode Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            onClick={() => setAgentMode('PROMPT_CONFIGURED')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              agentMode === 'PROMPT_CONFIGURED'
                ? 'bg-cyan-500/10 border-cyan-500 text-slate-900 dark:text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3 mb-2">
              <Terminal className="w-5 h-5 text-cyan-500" />
              <span className="font-bold text-sm">Prompt-Configured Agent</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configured entirely via system prompts, model parameters, and sandboxed tool capabilities.
            </p>
          </div>

          <div
            onClick={() => setAgentMode('REPO_BACKED')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              agentMode === 'REPO_BACKED'
                ? 'bg-purple-500/10 border-purple-500 text-slate-900 dark:text-white shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <GitBranch className="w-5 h-5 text-purple-500" />
                <span className="font-bold text-sm">Repo-Backed Agent</span>
              </div>
              {!hasGitHubAccess && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1 font-bold">
                  <GitBranch className="w-3 h-3" /> Action Required
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Connect a custom GitHub repository & branch. Builds autonomous Docker container image.
            </p>
          </div>
        </div>

        {/* GitHub Connection Box when Repo-Backed is selected but not connected */}
        {agentMode === 'REPO_BACKED' && !hasGitHubAccess && (
          <div className="p-6 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-slate-900 dark:text-white space-y-4 shadow-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Connect GitHub Installation</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Link your GitHub account to grant AgentChain permission to pull repository source code and build Docker images.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleConnectGitHubInline}
                disabled={isConnectingGitHub}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-2 shadow-md"
              >
                {isConnectingGitHub ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
                <span>Connect via GitHub App (OAuth)</span>
              </button>

              <button
                type="button"
                onClick={handleConnectDevGitHubInline}
                disabled={isConnectingGitHub}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-mono text-xs font-bold transition-colors flex items-center justify-center space-x-2 border border-purple-500/30"
              >
                {isConnectingGitHub ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-purple-400" />
                )}
                <span>Quick Connect GitHub (Dev/Test)</span>
              </button>
            </div>
          </div>
        )}

        {/* REPO_BACKED Selectors */}
        {agentMode === 'REPO_BACKED' && hasGitHubAccess && (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-slate-400">Target GitHub Repository</label>
              <button
                type="button"
                onClick={() => setIsCustomRepoInput(!isCustomRepoInput)}
                className="text-[11px] font-mono text-purple-600 dark:text-purple-400 hover:underline font-bold"
              >
                {isCustomRepoInput ? '← Select from Connected Repos' : '+ Type Custom GitHub Repo (URL or owner/repo)'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                {isCustomRepoInput ? (
                  <input
                    type="text"
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    placeholder="e.g. shravanis30/AgentChain- or owner/repository"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-purple-500/50 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                ) : (
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
                  >
                    {gitHubRepos.map((repo) => (
                      <option key={repo.id || repo.full_name} value={repo.full_name}>
                        {repo.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400">Branch / Ref</label>
                <input
                  type="text"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. System Prompt & LLM Provider */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-cyan-500" />
              System Instructions & Prompt
            </label>
            <textarea
              value={systemInstructions}
              onChange={(e) => setSystemInstructions(e.target.value)}
              rows={5}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Model Provider</label>
              <select
                value={modelProvider}
                onChange={(e) => setModelProvider(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google DeepMind</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Model Name</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0.0"
                max="1.0"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Max Tokens</label>
              <input
                type="number"
                step="512"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* 4. Tool Permissions */}
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-emerald-500" />
            Allowed Tool Sandbox Permissions
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={tools.web_search}
                onChange={(e) => setTools({ ...tools, web_search: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Web Search</span>
            </label>

            <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={tools.code_execution}
                onChange={(e) => setTools({ ...tools, code_execution: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Code Execution</span>
            </label>

            <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={tools.file_io}
                onChange={(e) => setTools({ ...tools, file_io: e.target.checked })}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>File System I/O</span>
            </label>

            <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={tools.shell_access}
                onChange={(e) => setTools({ ...tools, shell_access: e.target.checked })}
                className="rounded border-slate-700 text-rose-500 focus:ring-0"
              />
              <span className="text-rose-500 font-bold">Shell Access</span>
            </label>
          </div>
        </div>
      </div>

      {/* Submit Action */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 hover:opacity-95 transition-all flex items-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              <span>Creating Draft & Initializing Version...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Create Agent & Proceed to Validation</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
