'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { INR_DISCLAIMER } from '@/lib/currency';

interface CurrencyDisclaimerProps {
  className?: string;
  short?: boolean;
}

export function CurrencyDisclaimer({ className = '', short = false }: CurrencyDisclaimerProps) {
  return (
    <div
      className={`inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono ${className}`}
      title={INR_DISCLAIMER}
    >
      <Info className="w-3 h-3 flex-shrink-0 text-slate-400" />
      <span>
        {short
          ? 'Est. INR rate • Settled on-chain in USDC'
          : INR_DISCLAIMER}
      </span>
    </div>
  );
}
