'use client';

import { useState, useEffect } from 'react';

export const DEFAULT_USD_TO_INR = 83.50;
export const INR_DISCLAIMER =
  'Settled on-chain in USDC at the live exchange rate — INR is shown for convenience.';

// In-memory module cache for exchange rate
let cachedRate: number = DEFAULT_USD_TO_INR;
let cachedTimestamp: number = 0;
let cachedIsStale: boolean = false;
let cachedUpdatedAtStr: string = '';
const CACHE_LIFETIME_MS = 20 * 60 * 1000; // 20 minutes (within 15-30 min window)

/**
 * Formats a number into standard Indian Rupee representation (en-IN Lakhs / Crores comma placement).
 * E.g., 123456 -> ₹1,23,456
 * E.g., 10000000 -> ₹1,00,00,000
 */
export function formatINR(amount: number, showDecimals: boolean = false): string {
  if (amount == null || isNaN(amount)) return '₹0';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: showDecimals ? 2 : 0,
      minimumFractionDigits: showDecimals ? 2 : 0,
    }).format(amount);
  } catch {
    // Resilient fallback formatting with Indian grouping
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const roundedStr = showDecimals ? absAmount.toFixed(2) : Math.round(absAmount).toString();
    const [intPart, decPart] = roundedStr.split('.');

    let formattedInt = intPart;
    if (intPart.length > 3) {
      const last3 = intPart.slice(-3);
      const remaining = intPart.slice(0, -3);
      const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      formattedInt = `${grouped},${last3}`;
    }

    const decimalSuffix = showDecimals && decPart ? `.${decPart}` : '';
    return `${isNegative ? '-' : ''}₹${formattedInt}${decimalSuffix}`;
  }
}

/**
 * Formats a canonical USDC number string.
 */
export function formatUSDC(amount: number, maxDecimals: number = 2): string {
  if (amount == null || isNaN(amount)) return '$0.00 USDC';
  return `$${amount.toFixed(maxDecimals)} USDC`;
}

/**
 * Converts a USDC amount to INR based on an exchange rate.
 */
export function usdcToINR(usdc: number, rate: number = cachedRate): number {
  return (usdc || 0) * rate;
}

/**
 * Converts an INR amount to canonical USDC based on an exchange rate.
 * Rounds to 6 decimal places (USDC atomic precision) to avoid surprises.
 */
export function inrToUSDC(inr: number, rate: number = cachedRate): number {
  if (!rate || rate <= 0) return 0;
  return Number(((inr || 0) / rate).toFixed(6));
}

/**
 * Formats an ISO date string or timestamp into human-readable time for staleness notice.
 */
export function formatLastUpdated(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Hook to retrieve live or cached USDC -> INR exchange rate and format figures everywhere.
 */
export function useINR(usdcAmount?: number) {
  const [rate, setRate] = useState<number>(cachedRate);
  const [isLoading, setIsLoading] = useState<boolean>(cachedTimestamp === 0);
  const [isStale, setIsStale] = useState<boolean>(cachedIsStale);
  const [updatedAt, setUpdatedAt] = useState<string>(cachedUpdatedAtStr);

  useEffect(() => {
    const now = Date.now();
    if (cachedTimestamp > 0 && now - cachedTimestamp < CACHE_LIFETIME_MS) {
      setRate(cachedRate);
      setIsStale(cachedIsStale);
      setUpdatedAt(cachedUpdatedAtStr);
      setIsLoading(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    let isMounted = true;

    fetch(`${apiUrl}/api/v1/exchange-rate`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (isMounted && data && typeof data.usd_to_inr === 'number') {
          cachedRate = data.usd_to_inr;
          cachedTimestamp = Date.now();
          cachedIsStale = Boolean(data.is_stale);
          cachedUpdatedAtStr = data.updated_at || new Date().toISOString();

          setRate(data.usd_to_inr);
          setIsStale(cachedIsStale);
          setUpdatedAt(cachedUpdatedAtStr);
        }
      })
      .catch((err) => {
        // Graceful fallback to default/cached rate on network error
        console.warn('[Currency] Exchange rate fetch failed, using fallback:', err.message);
        if (isMounted) {
          cachedIsStale = true;
          setIsStale(true);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const safeUsdc = usdcAmount ?? 0;
  const inrAmount = safeUsdc * rate;
  const timeFormatted = formatLastUpdated(updatedAt);
  const lastUpdatedText = timeFormatted ? `Rate last updated at ${timeFormatted}` : 'Live exchange rate active';

  return {
    rate,
    isLoading,
    isStale,
    updatedAt,
    lastUpdatedText,
    inrAmount,
    formattedINR: formatINR(inrAmount),
    formattedINRWithDecimals: formatINR(inrAmount, true),
    formattedUSDC: formatUSDC(safeUsdc),
    disclaimer: INR_DISCLAIMER,
    formatAsINR: (amountInUSDC: number, showDecimals?: boolean) =>
      formatINR(amountInUSDC * rate, showDecimals),
    toUSDC: (amountInINR: number) => inrToUSDC(amountInINR, rate),
  };
}
