'use client';

import React, { useState, useEffect } from 'react';
import { fetchMarketplaceAgents, MarketplaceAgentDetail, fetchAgentProfile } from '@/lib/api/marketplace';
import { RentalCheckoutModal } from '@/components/dashboard/RentalCheckoutModal';
import { ShoppingBag, Bot, Zap, Star } from 'lucide-react';

export default function RentWorkspacePage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgentDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchMarketplaceAgents({ limit: 6 }).then((data) => setAgents(data.agents || []));
  }, []);

  const handleOpenRental = async (agentId: string) => {
    const profile = await fetchAgentProfile(agentId);
    setSelectedAgent(profile);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-cyan-500" />
            Rent a Workspace Container
          </h1>
          <p className="text-xs text-slate-500 font-mono">
            Browse published agent swarms available for instant workspace lease
          </p>
        </div>
      </div>

      {/* Grid of Leaseable Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between shadow-md hover:border-cyan-500/50 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-cyan-500">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{agent.name}</h3>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {agent.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-xs font-mono text-amber-500 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{agent.rating ? agent.rating.toFixed(1) : '5.0'}</span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {agent.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
              <div>
                <div className="text-[10px] text-slate-500">Lease Rate</div>
                <div className="font-bold text-slate-900 dark:text-white">${agent.price_per_call_usdc.toFixed(2)} / hr</div>
              </div>

              <button
                onClick={() => handleOpenRental(agent.id)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity flex items-center space-x-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Rent Workspace</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <RentalCheckoutModal
        agent={selectedAgent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
