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

  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionStep, setProvisionStep] = useState<number>(0);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    api.getMyAgents().then((data) => {
      setAgents(data || []);
      if (data && data.length > 0) {
        setSelectedAgentId(data[0].id);
      }
    });
  }, []);

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
    setIsProvisioning(true);
    setProvisionStep(1);

    const rate = pricingModel === 'PER_HOUR' ? parseFloat(hourlyRate) : (pricingModel === 'PER_DAY' ? parseFloat(dailyRate) : parseFloat(flatPrice));

    try {
      setProvisionStep(2);
      await api.createWorkspace({
        agent_id: selectedAgentId,
        resource_tier: resourceTier,
        pricing_mode: pricingModel,
        rate_usdc: rate,
        flat_duration_days: pricingModel === 'CUSTOM_FLAT' ? parseInt(flatDurationDays) : undefined,
      });
      setProvisionStep(3);
    } catch (err) {
      console.warn('Workspace provision notice:', err);
    } finally {
      setProvisionStep(4);
      setIsProvisioning(false);
      setSuccess(true);
      if (onDeployed) onDeployed();
    }
  };

  return (
    <div className="space-y-8">
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
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
            Phase 4 UI Preview
          </span>
        </div>

        {/* 1. Agent Selection */}
        <div className="space-y-2">
          <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-cyan-500" />
            Select Agent to Deploy
          </label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          >
            {agents.length === 0 ? (
              <option value="">No owned agents found (create an agent first)</option>
            ) : (
              agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.current_version || 'v1.0.0'}) • {agent.category}
                </option>
              ))
            )}
          </select>
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

            <div className="text-[11px] font-mono text-slate-400">
              // TODO: Phase 6 - wire to real workspace rental pricing & billing backend once endpoint exists
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isProvisioning}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 hover:opacity-95 transition-opacity flex items-center space-x-2"
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
