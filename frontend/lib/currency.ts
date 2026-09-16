'use client';

import { useState, useEffect } from 'react';

export const DEFAULT_USD_TO_INR = 83.50;
export const INR_DISCLAIMER =
  'Estimated INR value at current exchange rate. Settlement occurs on-chain in USDC.';

// In-memory module cache for exchange rate
let cachedRate: number = DEFAULT_USD_TO_INR;
let cachedTimestamp: number = 0;
const CACHE_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Formats a number into Indian Rupee representation (en-IN Lakhs / Crores comma placement).
 * E.g., 123456 -> ₹1,23,456
 * E.g., 10000000 -> ₹1,00,00,000
 */
export function formatINR(amount: number, showDecimals: boolean = false): string {
  if (amount == null || isNaN(amount)) return '₹0';

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

/**
 * Formats a canonical USDC number string.
 */
export function formatUSDC(amount: number): string {
  if (amount == null || isNaN(amount)) return '$0.00 USDC';
  return `$${amount.toFixed(2)} USDC`;
}

/**
 * Converts a USDC amount to INR based on an exchange rate.
 */
export function usdcToINR(usdc: number, rate: number = cachedRate): number {
  return (usdc || 0) * rate;
}

/**
 * Converts an INR amount to canonical USDC based on an exchange rate.
 */
export function inrToUSDC(inr: number, rate: number = cachedRate): number {
  if (!rate || rate <= 0) return 0;
  return Number(((inr || 0) / rate).toFixed(2));
}

/**
 * Hook to retrieve live or cached USDC -> INR exchange rate and format figures.
 */
export function useINR(usdcAmount?: number) {
  const [rate, setRate] = useState<number>(cachedRate);
  const [isLoading, setIsLoading] = useState<boolean>(cachedTimestamp === 0);

  useEffect(() => {
    const now = Date.now();
    if (cachedTimestamp > 0 && now - cachedTimestamp < CACHE_LIFETIME_MS) {
      setRate(cachedRate);
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
          setRate(data.usd_to_inr);
        }
      })
      .catch((err) => {
        // Graceful fallback to default/cached rate on network error
        console.warn('[Currency] Exchange rate fetch failed, using fallback:', err.message);
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

  return {
    rate,
    isLoading,
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
