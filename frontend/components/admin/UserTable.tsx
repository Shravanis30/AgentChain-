'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  UserX,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Filter,
  UserCheck,
  Wallet as WalletIcon
} from 'lucide-react';
import { api, AdminUser } from '@/lib/api-client';

export function UserTable() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load admin users:', err);
      setError(err?.message || 'Failed to retrieve registered users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const nextStatus = !user.is_active;
    const actionLabel = nextStatus ? 'Reactivate' : 'Suspend';

    try {
      setActionLoadingId(user.id);
      const res = await api.updateAdminUserStatus(user.id, nextStatus);

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: res.is_active } : u))
      );

      setToast({
        message: `Successfully ${res.is_active ? 'reactivated' : 'suspended'} account ${user.email}.`,
        type: 'success',
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      console.error(`Failed to ${actionLabel} user:`, err);
      setToast({
        message: err?.message || `Failed to ${actionLabel.toLowerCase()} user account.`,
        type: 'error',
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'ALL') {
        if (roleFilter === 'ADMIN') {
          if (!u.roles.includes('ADMIN') && !u.roles.includes('SUPER_ADMIN')) return false;
        } else if (roleFilter === 'AGENT_OWNER') {
          if (!u.roles.includes('AGENT_OWNER')) return false;
        } else if (roleFilter === 'USER') {
          if (u.roles.includes('ADMIN') || u.roles.includes('SUPER_ADMIN') || u.roles.includes('AGENT_OWNER')) {
            return false;
          }
        }
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && !u.is_active) return false;
      if (statusFilter === 'SUSPENDED' && u.is_active) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesEmail = u.email?.toLowerCase().includes(query);
        const matchesName = u.full_name?.toLowerCase().includes(query);
        const matchesId = u.id?.toLowerCase().includes(query);
        const matchesWallet = u.primary_wallet?.toLowerCase().includes(query) ||
          u.wallets?.some((w) => w.toLowerCase().includes(query));
        return matchesEmail || matchesName || matchesId || matchesWallet;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Aggregate stats
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.is_active).length;
  const suspendedCount = users.filter((u) => !u.is_active).length;
  const walletLinkedCount = users.filter((u) => u.primary_wallet || u.wallets_count > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-amber-500/20">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            User Account Management
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
            Real registered platform accounts, SIWE wallet links, and administrative controls
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh user list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            Refresh
          </button>
          <span className="text-xs font-mono px-3 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold border border-amber-500/30">
            {totalCount} REAL USERS
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Total Registered</div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {loading ? '-' : totalCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Active Accounts</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {loading ? '-' : activeCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Suspended</div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {loading ? '-' : suspendedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">SIWE Wallets Linked</div>
          <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-1">
            {loading ? '-' : walletLinkedCount}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl font-mono text-xs flex items-center space-x-2 border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email, name, wallet, or user ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs font-mono shadow-sm">
            <span className="text-[10px] text-slate-400 px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Role:
            </span>
            {(['ALL', 'ADMIN', 'AGENT_OWNER', 'USER'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  roleFilter === r
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r === 'AGENT_OWNER' ? 'DEVELOPER' : r}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 text-xs font-mono shadow-sm">
            <span className="text-[10px] text-slate-400 px-2">Status:</span>
            {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                  statusFilter === s
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">User / Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">SIWE Wallet Link</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading real platform users from database...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="text-rose-500 font-bold mb-2 flex items-center justify-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                    <button
                      onClick={fetchUsers}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-colors"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <span>No users match the selected filters or search query.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const hasWallet = !!u.primary_wallet;
                  const isSuspended = !u.is_active;
                  const isActionLoading = actionLoadingId === u.id;
                  const joinedFormatted = u.created_at
                    ? new Date(u.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A';

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* User Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-[11px] shrink-0">
                            {u.full_name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {u.full_name || (u.primary_wallet ? `User ${u.primary_wallet.slice(0, 6)}...${u.primary_wallet.slice(-4)}` : u.email)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                              <span className="font-mono">{u.raw_email || u.primary_wallet || 'No Email'}</span>
                              <span>•</span>
                              <span className="font-mono opacity-80" title={u.id}>
                                {u.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badges */}
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((role) => {
                            const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
                            const isDev = role === 'AGENT_OWNER';

                            return (
                              <span
                                key={role}
                                className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                                  isAdmin
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                    : isDev
                                    ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
                                }`}
                              >
                                {role === 'AGENT_OWNER' ? 'DEVELOPER' : role}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* SIWE Wallet */}
                      <td className="p-4 font-mono text-[11px]">
                        {hasWallet ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span title={u.primary_wallet!}>
                              {u.primary_wallet!.slice(0, 6)}...{u.primary_wallet!.slice(-4)}
                            </span>
                            <button
                              onClick={() => handleCopy(u.primary_wallet!)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                              title="Copy wallet address"
                            >
                              {copiedAddress === u.primary_wallet ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            {u.wallets_count > 1 && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                +{u.wallets_count - 1}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-normal">
                            Not Linked
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {joinedFormatted}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            u.is_active
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>

                      {/* Admin Action */}
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isActionLoading}
                          className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors border flex items-center gap-1.5 ml-auto ${
                            isSuspended
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-100 hover:bg-rose-500/10 text-slate-700 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-500/20 dark:text-slate-300 dark:hover:text-rose-400 border-slate-200 dark:border-slate-700'
                          } disabled:opacity-50`}
                          title={isSuspended ? 'Reactivate user account' : 'Suspend user account'}
                        >
                          {isActionLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isSuspended ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Reactivate
                            </>
                          ) : (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              Suspend
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Showing {filteredUsers.length} of {totalCount} registered platform users.</span>
          <span>Zero demo accounts. Real-time database sync via RBAC policy controls.</span>
        </div>
      </div>
    </div>
  );
}
