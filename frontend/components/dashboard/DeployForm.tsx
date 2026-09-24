'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Cpu,
  DollarSign,
  Sparkles,
  Check,
  CheckCircle2,
  Server,
  ShieldCheck,
  Loader2,
  GitBranch,
  Terminal,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Plus,
  Trash2,
  Search,
  Code2,
  Lock,
  Globe,
  Radio,
} from 'lucide-react';
import { AgentItem, api } from '@/lib/api-client';
import { useINR, formatINR } from '@/lib/currency';
import { CurrencyDisclaimer } from '@/components/common/CurrencyDisclaimer';

interface DeployFormProps {
  onDeployed?: () => void;
}

export function DeployForm({ onDeployed }: DeployFormProps) {
  const [activeTab, setActiveTab] = useState<'GITHUB' | 'EXISTING'>('GITHUB');

  // Existing Agents Mode State
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [buildStatuses, setBuildStatuses] = useState<Record<string, any>>({});

  // GitHub Repositories Mode State
  const [gitHubRepos, setGitHubRepos] = useState<any[]>([]);
  const [hasGitHubAccess, setHasGitHubAccess] = useState<boolean>(false);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(true);
  const [searchRepoQuery, setSearchRepoQuery] = useState<string>('');
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [projectName, setProjectName] = useState<string>('');
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([
    { key: 'PORT', value: '8080' },
  ]);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState<boolean>(false);

  // Common Resource & Pricing Configuration
  const [resourceTier, setResourceTier] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [pricingModel, setPricingModel] = useState<'PER_HOUR' | 'PER_DAY' | 'CUSTOM_FLAT'>('PER_HOUR');
  const { rate: exchangeRate } = useINR();

  const [hourlyRateINR, setHourlyRateINR] = useState<string>('1250');
  const [dailyRateINR, setDailyRateINR] = useState<string>('23400');
  const [flatPriceINR, setFlatPriceINR] = useState<string>('41750');
  const [flatDurationDays, setFlatDurationDays] = useState<string>('7');

  // Deployment Pipeline State (Vercel/Render style)
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployedWorkspace, setDeployedWorkspace] = useState<any | null>(null);
  const [deploymentVersionId, setDeploymentVersionId] = useState<string | null>(null);
  const [deployStep, setDeployStep] = useState<number>(0);
  const [terminalLogs, setTerminalLogs] = useState<string>('');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Load existing agents and GitHub repositories
  useEffect(() => {
    loadAgents();
    loadGitHub();
  }, []);

  const loadAgents = async () => {
    try {
      const [myAgents, publicAgents] = await Promise.all([
        api.getMyAgents(),
        api.getAgents(),
      ]);

      const combined = [...(myAgents || []), ...(publicAgents || [])];
      const uniqueAgents = Array.from(
        new Map(combined.map((ag) => [ag.id, ag])).values()
      );

      setAgents(uniqueAgents);
      if (uniqueAgents.length > 0 && !selectedAgentId) {
        setSelectedAgentId(uniqueAgents[0].id);
      }

      const statusMap: Record<string, any> = {};
      await Promise.all(
        uniqueAgents.map(async (ag) => {
          if (ag.current_version_id) {
            try {
              const b = await api.getBuildStatus(ag.id, ag.current_version_id);
              statusMap[ag.id] = b;
            } catch {
              statusMap[ag.id] = { status: 'PROMPT_ONLY' };
            }
          }
        })
      );
      setBuildStatuses(statusMap);
    } catch (err) {
      console.warn('Agent fetch notice:', err);
    }
  };

  const loadGitHub = async () => {
    setLoadingRepos(true);
    try {
      const data = await api.getGitHubRepos();
      if (data && data.connected && Array.isArray(data.repos) && data.repos.length > 0) {
        setGitHubRepos(data.repos);
        setHasGitHubAccess(true);
        if (!selectedRepo) {
          setSelectedRepo(data.repos[0]);
          setProjectName(data.repos[0].name || '');
          setSelectedBranch(data.repos[0].default_branch || 'main');
        }
      } else {
        setHasGitHubAccess(false);
        setGitHubRepos([]);
      }
    } catch {
      setHasGitHubAccess(false);
      setGitHubRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleConnectDevGitHub = async () => {
    setIsConnectingGitHub(true);
    setDeployError(null);
    try {
      await api.connectDevGitHub();
      await loadGitHub();
    } catch (err: any) {
      setDeployError(err?.message || 'Failed to connect test GitHub account.');
    } finally {
      setIsConnectingGitHub(false);
    }
  };

  const handleConnectGitHubApp = async () => {
    setIsConnectingGitHub(true);
    try {
      const res = await api.getGitHubInstallUrl('/dashboard/deploy');
      if (res.install_url) {
        window.location.href = res.install_url;
      }
    } catch (err: any) {
      setDeployError(err?.message || 'Failed to get GitHub App install URL.');
      setIsConnectingGitHub(false);
    }
  };

  // Convert user INR inputs to USDC for on-chain settlement
  const parsedHourlyINR = parseFloat(hourlyRateINR) || 0;
  const parsedDailyINR = parseFloat(dailyRateINR) || 0;
  const parsedFlatPriceINR = parseFloat(flatPriceINR) || 0;
  const parsedFlatDays = parseInt(flatDurationDays) || 1;

  const canonicalHourlyUSDC = Number((parsedHourlyINR / exchangeRate).toFixed(2));
  const canonicalDailyUSDC = Number((parsedDailyINR / exchangeRate).toFixed(2));
  const canonicalFlatPriceUSDC = Number((parsedFlatPriceINR / exchangeRate).toFixed(2));

  const canonicalRate =
    pricingModel === 'PER_HOUR'
      ? canonicalHourlyUSDC
      : pricingModel === 'PER_DAY'
      ? canonicalDailyUSDC
      : canonicalFlatPriceUSDC;

  const resourcePresets = [
    {
      id: 'SMALL',
      name: 'Small Sandbox',
      specs: '1 vCPU • 512 MB RAM',
      multiplier: 1.0,
      description: 'Isolated container for microservices, lightweight webhooks, and single-task jobs.',
    },
    {
      id: 'MEDIUM',
      name: 'Medium Swarm',
      specs: '2 vCPU • 1024 MB RAM',
      multiplier: 1.5,
      description: 'Standard sandboxed container for multi-agent reasoning, API workflows, and DAG execution.',
      recommended: true,
    },
    {
      id: 'LARGE',
      name: 'Large Enterprise',
      specs: '2 vCPU • 1536 MB RAM',
      multiplier: 2.5,
      description: 'High-capacity sandboxed container for data transformations, scraping, and high-concurrency tasks.',
    },
  ];

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // WebSocket Live Build/Deploy Stream Handler
  const connectLiveStream = (versionId: string, wsId?: string) => {
    setDeploymentVersionId(versionId);
    const wsUrl = `ws://localhost:8000/api/v1/ws/builds/${versionId}`;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'BUILD_LOG_UPDATE') {
            setTerminalLogs(data.build_log || '');
            if (data.status === 'BUILDING') {
              setDeployStep(3);
            } else if (data.status === 'SUCCEEDED') {
              setDeployStep(5);
              setIsLive(true);
              setIsDeploying(false);
            } else if (data.status === 'FAILED' || data.status === 'BLOCKED_SECRET') {
              setDeployError(`Build pipeline failed: ${data.status}`);
              setIsDeploying(false);
            }
          }
        } catch {
          // ignore parsing error
        }
      };
    } catch {
      // WebSocket fallback polling
    }

    // Polling fallback to guarantee state synchronization
    const pollInterval = setInterval(async () => {
      try {
        if (wsId) {
          const wsInfo = await api.getWorkspace(wsId);
          if (wsInfo && wsInfo.status === 'RUNNING') {
            setIsLive(true);
            setDeployStep(5);
            setIsDeploying(false);
            setDeployedWorkspace((prev: any) => ({ ...prev, ...wsInfo }));
            clearInterval(pollInterval);
          }
        }
      } catch {
        // ignore polling error
      }
    }, 2000);

    return () => {
      if (socket) socket.close();
      clearInterval(pollInterval);
    };
  };

  // 1-Click Vercel/Render GitHub Deployment Trigger
  const handleDeployFromGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) {
      setDeployError('Please select a GitHub repository to deploy.');
      return;
    }

    setDeployError(null);
    setIsDeploying(true);
    setIsLive(false);
    setDeployStep(1);
    setTerminalLogs(`[DEPLOY INIT] Triggering deployment for ${selectedRepo.full_name} (${selectedBranch})...\n[CONFIG] Allocating isolated container workspace runtime...`);

    const envMap: Record<string, string> = {};
    envVars.forEach((v) => {
      if (v.key.trim()) envMap[v.key.trim()] = v.value;
    });

    try {
      setDeployStep(2);
      const res = await api.deployFromGitHub({
        repo_full_name: selectedRepo.full_name,
        branch: selectedBranch || 'main',
        installation_id: selectedRepo.installation_id,
        project_name: projectName || selectedRepo.name,
        resource_tier: resourceTier,
        pricing_mode: pricingModel,
        rate_usdc: canonicalRate,
        flat_duration_days: pricingModel === 'CUSTOM_FLAT' ? parsedFlatDays : undefined,
        env_vars: envMap,
      });

      setDeployedWorkspace(res);
      setDeployStep(3);

      // Fetch version ID from agent to connect WebSocket
      const agentDetail = await api.getAgentDetail(res.agent_id);
      const versionId = agentDetail?.current_version_id || agentDetail?.current_version?.id;

      if (versionId) {
        connectLiveStream(versionId, res.id);
      } else {
        setIsLive(true);
        setDeployStep(5);
        setIsDeploying(false);
      }

      if (onDeployed) onDeployed();
    } catch (err: any) {
      setDeployError(err?.message || 'Failed to trigger GitHub deployment pipeline.');
      setIsDeploying(false);
    }
  };

  // Traditional Existing Agent Deployment Trigger
  const handleDeployExistingAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setDeployError('Please select an agent to deploy.');
      return;
    }

    setDeployError(null);
    setIsDeploying(true);
    setIsLive(false);
    setDeployStep(1);
    setTerminalLogs(`[DEPLOY INIT] Deploying agent workspace container (Agent ID: ${selectedAgentId})...\n[CONFIG] Provisioning Docker runtime...`);

    try {
      setDeployStep(3);
      const res = await api.createWorkspace({
        agent_id: selectedAgentId,
        resource_tier: resourceTier,
        pricing_mode: pricingModel,
        rate_usdc: canonicalRate,
        flat_duration_days: pricingModel === 'CUSTOM_FLAT' ? parsedFlatDays : undefined,
      });

      setDeployedWorkspace(res);
      setDeployStep(5);
      setIsLive(true);
      setIsDeploying(false);
      setTerminalLogs((prev) => `${prev}\n✓ Docker container provisioned successfully.\n✓ Container ID: ${res.docker_container_id || res.id}\n[DEPLOY READY] Virtual Workspace is RUNNING!`);
      if (onDeployed) onDeployed();
    } catch (err: any) {
      setDeployError(err?.message || 'Failed to provision container workspace.');
      setIsDeploying(false);
    }
  };

  const filteredRepos = gitHubRepos.filter((r) =>
    r.full_name?.toLowerCase().includes(searchRepoQuery.toLowerCase()) ||
    r.name?.toLowerCase().includes(searchRepoQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              AGENTCHAIN CLOUD RUNTIME
            </span>
            <span className="text-xs text-slate-400 font-mono">• Vercel & Render Parity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-2.5">
            <Server className="w-7 h-7 text-cyan-500" />
            <span>Deploy Project & Workspace</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">
            Import from GitHub or deploy an existing autonomous agent with automated sandboxed compilation
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="p-1 rounded-2xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 grid grid-cols-2 sm:flex items-center shadow-inner w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('GITHUB')}
            className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center space-x-2 min-h-[44px] ${
              activeTab === 'GITHUB'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Import from GitHub</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EXISTING')}
            className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center space-x-2 min-h-[44px] ${
              activeTab === 'EXISTING'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Existing Agent</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {deployError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Error: {deployError}</span>
          </div>
          <button
            onClick={() => setDeployError(null)}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold transition-colors"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* VERCEL / RENDER LIVE DEPLOYMENT CONSOLE (ACTIVE WHEN DEPLOYING OR LIVE) */}
      {(isDeploying || isLive) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border border-cyan-500/30 space-y-6 shadow-2xl backdrop-blur-xl"
        >
          {/* Header Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                {isLive ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isLive ? 'Deployment Ready & Live!' : 'Deploying Sandboxed Container...'}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isLive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 animate-pulse'
                    }`}
                  >
                    {isLive ? 'STATUS: LIVE' : 'STATUS: COMPILING'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedRepo ? `${selectedRepo.full_name} (${selectedBranch})` : 'Virtual Workspace Instance'}
                </p>
              </div>
            </div>

            {isLive && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <a
                  href="/dashboard/workspaces"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs shadow-md transition-colors inline-flex items-center justify-center space-x-1.5 min-h-[44px]"
                >
                  <span>Open in My Workspaces →</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeploying(false);
                    setIsLive(false);
                    setDeployedWorkspace(null);
                    setTerminalLogs('');
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] flex items-center justify-center"
                >
                  Deploy Another Project
                </button>
              </div>
            )}
          </div>

          {/* Stepper Pipeline Progress (Vercel Style) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                deployStep >= 1
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                {deployStep > 1 ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping shrink-0" />}
                <span>1. Clone Repository</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal mt-1">Shallow fetch tree</p>
            </div>

            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                deployStep >= 2
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                {deployStep > 2 ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : deployStep === 2 ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500 shrink-0" /> : null}
                <span>2. Secret Audit</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal mt-1">Static leak scan</p>
            </div>

            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                deployStep >= 3
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                {deployStep > 3 ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : deployStep === 3 ? <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500 shrink-0" /> : null}
                <span>3. Build Container</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal mt-1">Multi-stage compiler</p>
            </div>

            <div
              className={`p-3.5 rounded-2xl border transition-all ${
                deployStep >= 4
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                {isLive ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : deployStep === 4 ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 shrink-0" /> : null}
                <span>4. Runtime Live</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal mt-1">Docker sandbox ready</p>
            </div>
          </div>

          {/* Live Streaming Terminal Console */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-slate-400 ml-2">deployment-pipeline.log</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse text-cyan-400" />
                LIVE STREAM
              </span>
            </div>

            <pre className="p-4 sm:p-5 text-[11px] sm:text-xs font-mono text-cyan-300 bg-slate-950 leading-relaxed overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {terminalLogs || 'Waiting for ephemeral build container lease...'}
              <div ref={terminalEndRef} />
            </pre>
          </div>

          {/* Deployment Metadata Box */}
          {deployedWorkspace && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Workspace ID</span>
                <span className="font-bold text-slate-900 dark:text-white break-all">{deployedWorkspace.id}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Docker Container ID</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400 break-all">
                  {deployedWorkspace.docker_container_id ? deployedWorkspace.docker_container_id.slice(0, 16) : 'Provisioning...'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Hardware Sizing</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {deployedWorkspace.resource_tier || resourceTier} ({deployedWorkspace.ram_usage_mb || 1024} MB)
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* TAB 1: IMPORT FROM GITHUB (VERCEL / RENDER STYLE) */}
      {activeTab === 'GITHUB' && !isDeploying && !isLive && (
        <div className="space-y-6">
          {/* GitHub Connection State */}
          {!hasGitHubAccess ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                <GitBranch className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Connect Your GitHub Repositories</h3>
                <p className="text-xs text-slate-500 font-mono">
                  Link your personal GitHub account or organization to deploy autonomous agent containers in 1-click.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConnectDevGitHub}
                  disabled={isConnectingGitHub}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isConnectingGitHub ? 'Connecting...' : 'Quick Connect (Dev Repositories)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleConnectGitHubApp}
                  disabled={isConnectingGitHub}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 min-h-[44px]"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Connect via GitHub App (OAuth)</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleDeployFromGitHub} className="space-y-6">
              {/* Repository Selector Card (Vercel Style) */}
              <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
                      <GitBranch className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Select Repository to Deploy</h2>
                      <p className="text-xs text-slate-500 font-mono">Found {gitHubRepos.length} connected repository sources</p>
                    </div>
                  </div>

                  {/* Search Repos */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={searchRepoQuery}
                      onChange={(e) => setSearchRepoQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                </div>

                {/* Repo List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {filteredRepos.map((repo) => {
                    const isSelected = selectedRepo?.full_name === repo.full_name;
                    return (
                      <div
                        key={repo.id}
                        onClick={() => {
                          setSelectedRepo(repo);
                          setProjectName(repo.name || '');
                          setSelectedBranch(repo.default_branch || 'main');
                        }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/40'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="space-y-1 truncate pr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {repo.name}
                            </span>
                            {repo.is_private ? (
                              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                            ) : (
                              <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-slate-500 truncate">
                            {repo.full_name} • {repo.default_branch || 'main'}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {repo.language || 'Code'}
                          </span>
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isSelected ? 'bg-cyan-500 text-white' : 'border border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vercel / Render Deployment Configuration Form */}
              {selectedRepo && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
                  <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Deployment Settings & Environment</h2>
                      <p className="text-xs text-slate-500 font-mono">
                        Configuring <span className="text-cyan-600 dark:text-cyan-400 font-bold">{selectedRepo.full_name}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        Project / Agent Name
                      </label>
                      <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        Deployment Branch
                      </label>
                      <input
                        type="text"
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                    </div>
                  </div>

                  {/* Resource Sizing Presets */}
                  <div className="space-y-3">
                    <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-cyan-500" />
                      Container Hardware Sizing (vCPU & RAM Limits)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {resourcePresets.map((preset) => {
                        const isSelected = resourceTier === preset.id;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => setResourceTier(preset.id as any)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                              isSelected
                                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/40'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            {preset.recommended && (
                              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500 text-white">
                                POPULAR
                              </span>
                            )}
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">{preset.name}</h4>
                            <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-bold mt-0.5">{preset.specs}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{preset.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing & Rental Model */}
                  <div className="space-y-3">
                    <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                      Workspace Lease Rate (Settled on-chain in USDC)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono text-slate-500">Hourly Rate (INR)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">₹</span>
                          <input
                            type="number"
                            value={hourlyRateINR}
                            onChange={(e) => setHourlyRateINR(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">≈ ${canonicalHourlyUSDC} USDC/hr</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono text-slate-500">Daily Rate (INR)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">₹</span>
                          <input
                            type="number"
                            value={dailyRateINR}
                            onChange={(e) => setDailyRateINR(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">≈ ${canonicalDailyUSDC} USDC/day</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-mono text-slate-500">Fixed Lease Rate (INR)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">₹</span>
                          <input
                            type="number"
                            value={flatPriceINR}
                            onChange={(e) => setFlatPriceINR(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">≈ ${canonicalFlatPriceUSDC} USDC flat</span>
                      </div>
                    </div>
                  </div>

                  {/* Environment Variables Builder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        Environment Variables (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                        className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Variable</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {envVars.map((env, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                          <input
                            type="text"
                            placeholder="VARIABLE_NAME"
                            value={env.key}
                            onChange={(e) => {
                              const updated = [...envVars];
                              updated[idx].key = e.target.value;
                              setEnvVars(updated);
                            }}
                            className="w-full sm:w-1/2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white min-h-[44px]"
                          />
                          <div className="flex items-center space-x-2 w-full sm:w-1/2">
                            <input
                              type="text"
                              placeholder="value"
                              value={env.value}
                              onChange={(e) => {
                                const updated = [...envVars];
                                updated[idx].value = e.target.value;
                                setEnvVars(updated);
                              }}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white min-h-[44px]"
                            />
                            {envVars.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setEnvVars(envVars.filter((_, i) => i !== idx))}
                                className="p-2.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Deploy Action Button */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <CurrencyDisclaimer />
                    <button
                      type="submit"
                      disabled={isDeploying}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:opacity-95 text-white font-bold font-mono text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 min-h-[44px] w-full sm:w-auto"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Deploy with AgentChain</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* TAB 2: DEPLOY EXISTING AGENT */}
      {activeTab === 'EXISTING' && !isDeploying && !isLive && (
        <form onSubmit={handleDeployExistingAgent} className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Deploy Existing Agent Version</h2>
              <p className="text-xs text-slate-500 font-mono">Select an agent created in your dashboard to spin up a virtual container</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Select Agent
            </label>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              {agents.length === 0 ? (
                <option value="">No agents found (create an agent first)</option>
              ) : (
                agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.current_version || 'v1.0.0'}) • {ag.category}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Resource Sizing Presets */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-500" />
              Container Hardware Sizing
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {resourcePresets.map((preset) => {
                const isSelected = resourceTier === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setResourceTier(preset.id as any)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/40'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{preset.name}</h4>
                    <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-bold mt-0.5">{preset.specs}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{preset.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <CurrencyDisclaimer />
            <button
              type="submit"
              disabled={isDeploying || agents.length === 0}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-95 text-white font-bold font-mono text-sm shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 min-h-[44px] w-full sm:w-auto"
            >
              <Server className="w-4 h-4" />
              <span>Launch Workspace Container</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
