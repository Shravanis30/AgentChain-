'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Cpu, DollarSign, Sparkles, Check, Server, ShieldCheck, Loader2, Clock, Calendar } from 'lucide-react';
import { AgentItem, api } from '@/lib/api-client';

interface DeployFormProps {
  onDeployed?: () => void;
}

export function DeployForm({ onDeployed }: DeployFormProps) {
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [resourceTier, setResourceTier] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('MEDIUM');
  const [pricingModel, setPricingModel] = useState<'PER_HOUR' | 'PER_DAY' | 'CUSTOM_FLAT'>('PER_HOUR');
  
  const [hourlyRate, setHourlyRate] = useState<string>('15.00');
  const [dailyRate, setDailyRate] = useState<string>('280.00');
  const [flatPrice, setFlatPrice] = useState<string>('500.00');
  const [flatDurationDays, setFlatDurationDays] = useState<string>('7');

  const [buildStatuses, setBuildStatuses] = useState<Record<string, any>>({});
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionStep, setProvisionStep] = useState<number>(0);
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgentsData = async () => {
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
        if (uniqueAgents.length > 0) {
          setSelectedAgentId(uniqueAgents[0].id);

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
        }
      } catch (err: any) {
        console.warn('Agent fetch warning:', err);
      }
    };
    fetchAgentsData();
  }, []);

  const selectedAgent = agents.find((ag) => ag.id === selectedAgentId);
  const selectedBuild = selectedAgentId ? buildStatuses[selectedAgentId] : null;

  // Pricing range validation
  const parsedHourly = parseFloat(hourlyRate);
  const parsedDaily = parseFloat(dailyRate);
  const parsedFlatPrice = parseFloat(flatPrice);
  const parsedFlatDays = parseInt(flatDurationDays);

  const getValidationError = (): string | null => {
    if (!selectedAgentId) return 'Please select an agent to deploy.';
    if (pricingModel === 'PER_HOUR' && (isNaN(parsedHourly) || parsedHourly <= 0)) {
      return 'Hourly lease rate must be greater than 0 USDC.';
    }
    if (pricingModel === 'PER_DAY' && (isNaN(parsedDaily) || parsedDaily <= 0)) {
      return 'Daily lease rate must be greater than 0 USDC.';
    }
    if (pricingModel === 'CUSTOM_FLAT') {
      if (isNaN(parsedFlatPrice) || parsedFlatPrice <= 0) {
        return 'Flat rate price must be greater than 0 USDC.';
      }
      if (isNaN(parsedFlatDays) || parsedFlatDays < 1) {
        return 'Fixed lease duration must be at least 1 day.';
      }
    }
    return null;
  };

  const validationError = getValidationError();

  const resourcePresets = [
    {
      id: 'SMALL',
      name: 'Small Sandbox',
      specs: '2 vCPU • 4 GB RAM • 20 GB NVMe',
      multiplier: 1.0,
      description: 'Ideal for lightweight document parsing & static code audit jobs.',
    },
    {
      id: 'MEDIUM',
      name: 'Medium Swarm',
      specs: '4 vCPU • 8 GB RAM • 50 GB NVMe',
      multiplier: 1.5,
      description: 'Recommended for multi-thread DEX arbitrage & parallel test runners.',
    },
    {
      id: 'LARGE',
      name: 'Large Enterprise',
      specs: '8 vCPU • 16 GB RAM • 100 GB NVMe',
      multiplier: 2.5,
      description: 'High-throughput cluster for heavy LLM fine-tuning & continuous indexing.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;

    setErrorMsg(null);
    setIsProvisioning(true);
    setProvisionStep(1);

    const rate =
      pricingModel === 'PER_HOUR'
        ? parsedHourly
        : pricingModel === 'PER_DAY'
        ? parsedDaily
        : parsedFlatPrice;

    try {
      setProvisionStep(2);
      await api.createWorkspace({
        agent_id: selectedAgentId,
        resource_tier: resourceTier,
        pricing_mode: pricingModel,
        rate_usdc: rate,
        flat_duration_days: pricingModel === 'CUSTOM_FLAT' ? parsedFlatDays : undefined,
      });
      setProvisionStep(3);
      setSuccess(true);
      if (onDeployed) onDeployed();
    } catch (err: any) {
      const msg = err?.message || 'Failed to provision container workspace.';
      setErrorMsg(msg);
    } finally {
      setProvisionStep(4);
      setIsProvisioning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-mono text-xs flex items-center justify-between">
          <p className="font-bold">Error: {errorMsg}</p>
          <button
            onClick={() => setErrorMsg(null)}
            className="px-3 py-1 rounded bg-rose-500/20 text-rose-400 font-bold hover:bg-rose-500/30 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Notification */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="font-bold">Workspace Container Provisioned Successfully!</p>
              <p className="text-[11px] text-slate-500">Live heartbeat stream established. Real-time earnings active.</p>
            </div>
          </div>
          <button
            onClick={() => setSuccess(false)}
            className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold hover:bg-emerald-500/30 transition-colors"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Main Deployment Form */}
      <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Deploy Virtual Workspace
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Provision isolated container runtime for your agent
              </p>
            </div>
          </div>
        </div>

        {/* 1. Agent Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-cyan-500" />
              Select Agent to Deploy
            </label>
            {agents.length === 0 && (
              <a
                href="/dashboard/agents/new"
                className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>+ Create New Agent</span>
              </a>
            )}
          </div>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            {agents.length === 0 ? (
              <option value="">No owned agents found (create an agent first)</option>
            ) : (
              agents.map((agent) => {
                const b = buildStatuses[agent.id];
                const bLabel = b?.status ? ` [Build: ${b.status}]` : '';
                return (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.current_version || 'v1.0.0'}{bLabel}) • {agent.category}
                  </option>
                );
              })
            )}
          </select>

          {selectedBuild && (
            <div className="flex items-center justify-between font-mono text-xs pt-1 px-1">
              <span className="text-slate-500">
                Container Image Build Status:
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedBuild.status === 'SUCCEEDED'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : selectedBuild.status === 'BUILDING'
                    ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 animate-pulse'
                    : selectedBuild.status === 'BLOCKED_SECRET' || selectedBuild.status === 'FAILED'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                }`}
              >
                {selectedBuild.status || 'PROMPT_ONLY'}
              </span>
            </div>
          )}

          {agents.length === 0 && (
            <p className="text-[11px] font-mono text-amber-500 pt-1">
              No agents created yet.{' '}
              <a href="/dashboard/agents/new" className="font-bold underline">
                Click here to create your first agent
              </a>
            </p>
          )}
        </div>

        {/* 2. Resource Tier Presets */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-purple-500" />
            Resource Tier Preset
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {resourcePresets.map((tier) => (
              <div
                key={tier.id}
                onClick={() => setResourceTier(tier.id as any)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  resourceTier === tier.id
                    ? 'bg-cyan-500/10 border-cyan-500 text-slate-900 dark:text-white shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs font-bold mb-1">
                  <span>{tier.name}</span>
                  {resourceTier === tier.id && <Check className="w-4 h-4 text-cyan-500" />}
                </div>
                <p className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold mb-2">
                  {tier.specs}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {tier.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Pricing Model Selection */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Workspace Pricing Model
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setPricingModel('PER_HOUR')}
              className={`p-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
                pricingModel === 'PER_HOUR'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>PER HOUR</span>
            </button>

            <button
              type="button"
              onClick={() => setPricingModel('PER_DAY')}
              className={`p-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
                pricingModel === 'PER_DAY'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>PER DAY</span>
            </button>

            <button
              type="button"
              onClick={() => setPricingModel('CUSTOM_FLAT')}
              className={`p-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all min-h-[44px] ${
                pricingModel === 'CUSTOM_FLAT'
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>CUSTOM FLAT</span>
            </button>
          </div>

          {/* Dynamic Rate Form Fields */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 pt-4">
            {pricingModel === 'PER_HOUR' && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-500">Hourly Lease Rate (USDC / hr)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="0.5"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}

            {pricingModel === 'PER_DAY' && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-500">Daily Lease Rate (USDC / day)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    step="5"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}

            {pricingModel === 'CUSTOM_FLAT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-500">Flat Rate Price (USDC)</label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      step="10"
                      value={flatPrice}
                      onChange={(e) => setFlatPrice(e.target.value)}
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-500">Fixed Lease Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={flatDurationDays}
                    onChange={(e) => setFlatDurationDays(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}

            {validationError && (
              <p className="text-[11px] font-mono text-rose-500 font-bold">
                ⚠️ {validationError}
              </p>
            )}

            <div className="text-[11px] font-mono text-slate-400">
              Escrow settlements and lease rates automatically calculated based on resource tier.
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex items-center justify-between">
          <div className="text-xs font-mono text-slate-500">
            {validationError ? (
              <span className="text-rose-500 font-semibold">{validationError}</span>
            ) : (
              <span>Ready for container allocation</span>
            )}
          </div>
          <button
            type="submit"
            disabled={isProvisioning || !!validationError || agents.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center space-x-2"
          >
            {isProvisioning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Provisioning Container ({provisionStep}/3)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Provision & Launch Workspace</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
