'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  GitBranch,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Shield,
  Building,
  User as UserIcon,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api-client';

function ConnectedAccountsContent() {
  const searchParams = useSearchParams();
  const installedNotice = searchParams.get('installed');
  const installError = searchParams.get('install_error');
  const installationIdParam = searchParams.get('installation_id');

  const [installations, setInstallations] = useState<any[]>([]);
  const [repoCounts, setRepoCounts] = useState<Record<string, number>>({});
  const [totalReposCount, setTotalReposCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (installationIdParam) {
        try {
          await api.linkGitHubInstallation(installationIdParam);
          setSuccessMsg('GitHub App installation linked successfully!');
        } catch (e: any) {
          setError(e.message || 'Failed to link GitHub installation.');
        }
      } else if (installedNotice) {
        setSuccessMsg('GitHub App installation completed successfully!');
      }
      if (installError === 'invalid_installation') {
        setError('GitHub installation was invalid or revoked. Please try connecting again.');
      }
      await fetchInstallations();
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInstallations = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGitHubInstallations();
      setInstallations(data || []);

      // Also fetch repo data to show repo counts per installation
      const reposData = await api.getGitHubRepos();
      if (reposData && Array.isArray(reposData.repos)) {
        setTotalReposCount(reposData.repos.length);
        const counts: Record<string, number> = {};
        for (const repo of reposData.repos) {
          const instId = repo.installation_id;
          if (instId) {
            counts[instId] = (counts[instId] || 0) + 1;
          }
        }
        setRepoCounts(counts);
      }
    } catch (err: any) {
      console.warn('Failed to load GitHub installations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncInstallations = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      await api.syncGitHubInstallations();
      setSuccessMsg('GitHub installations and repositories synced successfully!');
      await fetchInstallations();
    } catch (err: any) {
      setError(err.message || 'Failed to sync GitHub installations.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const res = await api.getGitHubInstallUrl('/dashboard/settings/connected-accounts');
      if (res.install_url) {
        window.location.href = res.install_url;
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate GitHub App connection.');
      setIsConnecting(false);
    }
  };

  const handleConnectDevGitHub = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await api.connectDevGitHub();
      setSuccessMsg('Development GitHub account connected successfully.');
      await fetchInstallations();
    } catch (err: any) {
      setError(err.message || 'Failed to connect development GitHub account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (dbId: string, login: string) => {
    if (!confirm(`Are you sure you want to disconnect @${login} from AgentChain?`)) {
      return;
    }

    try {
      await api.disconnectGitHubInstallation(dbId);
      setInstallations((prev) => prev.filter((item) => item.id !== dbId));
      setSuccessMsg(`Disconnected @${login} successfully.`);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect GitHub installation.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Connected Accounts & GitHub Apps</span>
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                Manage multi-tenant GitHub App installations for repo-backed AI agents
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSyncInstallations}
              disabled={isSyncing || isLoading}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold border border-slate-300 dark:border-slate-700 transition-colors inline-flex items-center space-x-1.5"
              title="Sync installations directly from GitHub App"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync GitHub'}</span>
            </button>

            <button
              type="button"
              onClick={handleConnectDevGitHub}
              disabled={isConnecting}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-mono text-xs font-bold border border-purple-500/30 transition-colors inline-flex items-center space-x-1.5"
            >
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <span>Quick Connect (Dev)</span>
            </button>

            <button
              type="button"
              onClick={handleConnectGitHub}
              disabled={isConnecting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-xs shadow-md shadow-purple-500/20 hover:opacity-95 transition-opacity inline-flex items-center space-x-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Redirecting...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Connect GitHub App (OAuth)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs flex items-center justify-between"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </motion.div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-mono text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Installations Card Container */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Active GitHub App Installations</h2>
            <p className="text-xs text-slate-500 font-mono">
              Repositories are isolated per installation ({totalReposCount} accessible repository{totalReposCount === 1 ? '' : 'ies'}).
            </p>
          </div>

          <a
            href="https://github.com/settings/installations"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center space-x-1"
          >
            <span>Manage on GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {isLoading ? (
          <div className="p-8 text-center space-y-3 font-mono">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Fetching active installations from database...</p>
          </div>
        ) : installations.length === 0 ? (
          <div className="p-12 text-center space-y-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
            <GitBranch className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No GitHub Installations Connected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Connect your personal GitHub account or organization to grant AgentChain access to specific repositories for container builds.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSyncInstallations}
                disabled={isSyncing || isLoading}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-cyan-300 font-mono text-xs font-bold border border-cyan-500/30 hover:bg-slate-700 transition-all inline-flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Active Installations'}</span>
              </button>

              <button
                type="button"
                onClick={handleConnectGitHub}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Connect via GitHub App (OAuth)</span>
              </button>

              <button
                type="button"
                onClick={handleConnectDevGitHub}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-purple-300 font-mono text-xs font-bold border border-purple-500/30 hover:bg-slate-700 transition-all inline-flex items-center space-x-2"
              >
                <GitBranch className="w-4 h-4 text-purple-400" />
                <span>Quick Connect (Dev/Test)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {installations.map((inst) => {
              const count = repoCounts[inst.installation_id] ?? 0;
              return (
                <div
                  key={inst.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center space-x-4">
                    {inst.avatar_url ? (
                      <Image
                        src={inst.avatar_url}
                        alt={inst.account_login}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full border border-slate-300 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500">
                        {inst.account_type === 'Organization' ? <Building className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                      </div>
                    )}

                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">@{inst.account_login}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {inst.account_type || 'User'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                          {count} repo{count === 1 ? '' : 's'} installed
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Installation ID: {inst.installation_id}
                      </p>
                    </div>
                  </div>

                <div className="flex items-center space-x-3">
                  <a
                    href="https://github.com/settings/installations"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center space-x-1"
                  >
                    <span>Settings</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDisconnect(inst.id, inst.account_login)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-xs hover:bg-rose-500/20 transition-colors inline-flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConnectedAccountsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center font-mono space-y-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading connected accounts...</p>
        </div>
      }
    >
      <ConnectedAccountsContent />
    </Suspense>
  );
}
