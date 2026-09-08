'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Terminal, ShieldAlert, CheckCircle2, Clock, Cpu, ArrowLeft, RefreshCw, GitBranch } from 'lucide-react';
import { api } from '@/lib/api-client';

export default function BuildLogPage() {
  const params = useParams();
  const agentId = params.id as string;
  const versionId = params.version as string;

  const [buildData, setBuildData] = useState<any>(null);
  const [logs, setLogs] = useState<string>('Initializing container compilation stream...');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchBuildStatus();

    // Setup WebSocket live build log streaming
    const wsUrl = `ws://localhost:8000/api/v1/ws/builds/${versionId}`;
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.event === 'BUILD_LOG_UPDATE') {
          setLogs(data.build_log);
          setBuildData((prev: any) => ({
            ...prev,
            status: data.status,
            image_digest: data.image_digest,
            build_strategy: data.build_strategy,
          }));
        }
      };
    } catch (e) {
      console.warn('WebSocket connection notice:', e);
    }

    return () => {
      if (socket) socket.close();
    };
  }, [agentId, versionId]);

  const fetchBuildStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.getBuildStatus(agentId, versionId);
      setBuildData(res);
      setLogs(res.build_log || '[INFO] Build pipeline queued...');
    } catch (err) {
      console.warn('Build status fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> SUCCEEDED
          </span>
        );
      case 'BLOCKED_SECRET':
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-mono text-xs font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> BLOCKED (SECRET DETECTED)
          </span>
        );
      case 'BUILDING':
        return (
          <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono text-xs font-bold flex items-center gap-1.5 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> BUILDING
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 font-mono text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {status || 'QUEUED'}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-16 bg-slate-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard/workspaces"
              className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Workspaces</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Terminal className="w-7 h-7 text-cyan-500" />
              <span>Container Build Console</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Version ID: {versionId}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {buildData && getStatusBadge(buildData.status)}
            <button
              onClick={fetchBuildStatus}
              className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Build Metadata Panel */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Compiler Strategy</span>
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-500" />
              {buildData?.build_strategy || 'DOCKERFILE'}
            </span>
          </div>

          <div className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Image Artifact Digest</span>
            <span className="text-xs font-mono text-cyan-600 dark:text-cyan-400 break-all block">
              {buildData?.image_digest || 'registry.agentchain.ai/agents/workspace:v1.0.0@sha256:pending'}
            </span>
          </div>
        </div>

        {/* Terminal Log Output Window */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
          <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs font-mono text-slate-400 ml-2">sandboxed-build-runner.sh</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              STREAMING LIVE
            </span>
          </div>

          <div className="p-6 font-mono text-xs text-slate-200 overflow-x-auto min-h-[350px] max-h-[550px] space-y-1.5">
            {logs.split('\n').map((line, idx) => (
              <div
                key={idx}
                className={`leading-relaxed ${
                  line.includes('❌') || line.includes('CRITICAL') || line.includes('FAILED')
                    ? 'text-rose-400 font-bold'
                    : line.includes('✓') || line.includes('SUCCEEDED')
                    ? 'text-emerald-400'
                    : line.includes('[STAGE')
                    ? 'text-cyan-400 font-bold'
                    : 'text-slate-300'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
