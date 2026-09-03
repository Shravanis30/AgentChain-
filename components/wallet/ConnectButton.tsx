'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSignMessage } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';
import { Wallet, LogOut, ShieldCheck, UserCheck, Loader2, AlertCircle } from 'lucide-react';

export function ConnectButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { user, roles, isAuthenticated, isLoading: authLoading, loginWithSIWE, logout, error, clearError } = useAuth();

  const [signing, setSigning] = useState<boolean>(false);
  const [siweError, setSiweError] = useState<string | null>(null);

  // Reset errors whenever connected wallet address changes
  useEffect(() => {
    setSiweError(null);
    setSigning(false);
  }, [address]);

  const handleSIWE = async () => {
    if (!address) return;
    setSigning(true);
    setSiweError(null);
    clearError();

    try {
      await loginWithSIWE(address, chainId || 1, signMessageAsync);
      if (pathname === '/login' || pathname === '/register') {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.warn('SIWE authentication attempt error:', err);
      setSiweError(err.message || 'Signature rejected or verification failed.');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="relative inline-flex items-center space-x-2">
      {/* SIWE Error Notification Toast */}
      {(siweError || error) && (
        <div className="absolute top-12 right-0 z-50 w-72 p-3 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs shadow-xl flex items-start space-x-2 backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-rose-300">Authentication Alert</p>
            <p className="text-[11px] leading-tight text-rose-200">{siweError || error}</p>
            <button
              onClick={() => {
                setSiweError(null);
                clearError();
              }}
              className="text-[10px] underline text-rose-400 font-mono"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <RainbowConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          if (!ready) {
            return (
              <button disabled className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs font-mono">
                Loading...
              </button>
            );
          }

          // Case 1: Wallet Not Connected
          if (!connected) {
            return (
              <button
                onClick={openConnectModal}
                className="relative inline-flex items-center justify-center p-0.5 overflow-hidden text-xs font-semibold rounded-lg group bg-gradient-to-br from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-slate-900 dark:text-white shadow-md shadow-cyan-500/20 transition-all hover:scale-105"
              >
                <span className="relative px-4 py-2 transition-all ease-in duration-75 bg-white dark:bg-slate-900 rounded-md group-hover:bg-opacity-0 flex items-center space-x-2 text-slate-900 dark:text-white">
                  <Wallet className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:text-white" />
                  <span>Connect Wallet</span>
                </span>
              </button>
            );
          }

          // Case 2: Chain Unsupported
          if (chain.unsupported) {
            return (
              <button
                onClick={openChainModal}
                className="px-3.5 py-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-bold font-mono hover:bg-rose-500/30 transition-colors"
              >
                Wrong Network
              </button>
            );
          }

          // Case 3: Wallet Connected, but SIWE Signature Pending / Required
          if (!isAuthenticated) {
            return (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSIWE}
                  disabled={signing || authLoading}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 text-xs font-mono font-bold flex items-center space-x-2 transition-all shadow-sm"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      <span>Confirm in MetaMask...</span>
                    </>
                  ) : authLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Sign SIWE Nonce</span>
                    </>
                  )}
                </button>

                <button
                  onClick={openAccountModal}
                  className="px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-mono hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  title="Disconnect or Switch Wallet"
                >
                  {account.displayName}
                </button>
              </div>
            );
          }

          // Case 4: Fully Authenticated Session
          const primaryRole = roles[0] || 'USER';
          const displayName = user?.full_name || account.displayName;

          return (
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              {/* Chain Selector */}
              <button
                onClick={openChainModal}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                {chain.hasIcon && (
                  <div className="w-3.5 h-3.5 shrink-0">
                    {chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        width={14}
                        height={14}
                        loading="lazy"
                        className="w-3.5 h-3.5"
                      />
                    )}
                  </div>
                )}
                <span className="truncate max-w-[80px] md:max-w-none">{chain.name}</span>
              </button>

              {/* User Profile / Account Dropdown */}
              <div className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm min-h-[44px]">
                <button
                  onClick={openAccountModal}
                  className="flex items-center space-x-1.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate max-w-[80px] xs:max-w-[110px] sm:max-w-[140px] md:max-w-none">{displayName}</span>
                  <span className="hidden xs:inline-block text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/20">
                    {primaryRole}
                  </span>
                </button>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                  title="Logout Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        }}
      </RainbowConnectButton.Custom>
    </div>
  );
}
