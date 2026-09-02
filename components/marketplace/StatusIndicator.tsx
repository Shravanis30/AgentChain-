'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Radio } from 'lucide-react';

interface StatusIndicatorProps {
  agentId: string;
  initialStatus?: 'PUBLISHED' | 'RUNNING' | 'IDLE' | 'DRAFT';
  showLabel?: boolean;
}

export function StatusIndicator({
  agentId,
  initialStatus = 'RUNNING',
  showLabel = true,
}: StatusIndicatorProps) {
  const [status, setStatus] = useState<'RUNNING' | 'IDLE' | 'DRAFT'>(
    initialStatus === 'PUBLISHED' ? 'RUNNING' : (initialStatus as any) || 'RUNNING'
  );

  // Status Polling / WebSocket integration slot
  useEffect(() => {
    // TODO: Wire to real-time /api/v1/ws/workspaces/{agentId} once workspace WebSocket endpoint exists in Phase 4.
    // Currently simulates live runtime heartbeat.
    const interval = setInterval(() => {
      // Periodic heartbeat check placeholder
    }, 15000);
    return () => clearInterval(interval);
  }, [agentId]);

  const isLive = status === 'RUNNING';

  return (
    <div className="inline-flex items-center space-x-1.5 font-mono text-xs">
      <span className="relative flex h-2.5 w-2.5">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
            isLive ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
          }`}
        />
      </span>
      {showLabel && (
        <span
          className={`font-bold uppercase tracking-wider text-[11px] ${
            isLive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {isLive ? 'LIVE' : 'STANDBY'}
        </span>
      )}
    </div>
  );
}
