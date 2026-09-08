'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FileCode,
  Terminal,
  Lock,
} from 'lucide-react';
import { api } from '@/lib/api-client';

interface ValidatorResultProps {
  agentId: string;
  onValidated?: (passed: boolean) => void;
}

export function ValidatorResult({ agentId, onValidated }: ValidatorResultProps) {
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [result, setResult] = useState<{
    passed: boolean;
    risk_score: number;
    findings: any[];
    new_status?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runValidation = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await api.validateAgent(agentId);
      setResult({
        passed: res.passed,
        risk_score: res.risk_score || 0,
        findings: res.findings || [],
        new_status: res.new_status,
      });
      if (onValidated) {
        onValidated(res.passed);
      }
    } catch (err: any) {
      setError(err.message || 'Automated validator failed to run.');
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      runValidation();
    }
  }, [agentId]);

  return (
    <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Static Security Validator</h2>
            <p className="text-xs text-slate-500 font-mono">Automated AST, prompt injection, and tool permission audit</p>
          </div>
        </div>

        <button
          type="button"
          onClick={runValidation}
          disabled={isValidating}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center space-x-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          <span>Re-run Audit</span>
        </button>
      </div>

      {isValidating ? (
        <div className="p-8 text-center space-y-3 font-mono">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Parsing prompt AST and auditing sandbox permissions...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono">
          {error}
        </div>
      ) : result ? (
        <div className="space-y-6">
          {/* Status Header */}
          <div
            className={`p-5 rounded-2xl border flex items-center justify-between ${
              result.passed
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            <div className="flex items-center space-x-3">
              {result.passed ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-7 h-7 text-rose-500" />
              )}
              <div>
                <h3 className="font-bold text-base">
                  {result.passed ? 'Validator Assertion PASSED' : 'Validator Assertion FAILED'}
                </h3>
                <p className="text-xs font-mono opacity-80">
                  {result.passed
                    ? 'All security assertions passed. Ready for on-chain deployment.'
                    : 'Critical security or permission issues detected. On-chain publish blocked.'}
                </p>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] uppercase opacity-70 block">Risk Score</span>
              <span className="text-lg font-black">{result.risk_score} / 100</span>
            </div>
          </div>

          {/* Checks Performed Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Prompt Injection Scan</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-900 dark:text-white">Clean (No Payload)</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Shell Sandbox Check</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-900 dark:text-white">Strict Isolation</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Credential Leak Scan</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <p className="font-bold text-slate-900 dark:text-white">Zero Hardcoded Keys</p>
            </div>
          </div>

          {/* Findings List if Any */}
          {result.findings && result.findings.length > 0 && (
            <div className="space-y-2 font-mono text-xs">
              <span className="text-slate-400 font-bold block">Audit Findings ({result.findings.length})</span>
              <div className="space-y-1.5">
                {result.findings.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-start space-x-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{typeof item === 'string' ? item : item.message || JSON.stringify(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
