'use client';

import React from 'react';
import { Info, Clock } from 'lucide-react';
import { INR_DISCLAIMER, useINR } from '@/lib/currency';

interface CurrencyDisclaimerProps {
  className?: string;
  short?: boolean;
  showStaleness?: boolean;
}

export function CurrencyDisclaimer({
  className = '',
  short = false,
  showStaleness = true,
}: CurrencyDisclaimerProps) {
  const { isStale, lastUpdatedText } = useINR();

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono ${className}`}
      title={INR_DISCLAIMER}
    >
      <div className="flex items-center gap-1">
        <Info className="w-3 h-3 flex-shrink-0 text-slate-400" />
        <span>
          {short
            ? 'Settled on-chain in USDC at live rate'
            : INR_DISCLAIMER}
        </span>
      </div>

      {showStaleness && isStale && (
        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-2.5 h-2.5" />
          <span>{lastUpdatedText}</span>
        </span>
      )}
    </div>
  );
}
