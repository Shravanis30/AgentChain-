'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Sun, Moon, Menu, X, Cpu, LogIn, LayoutDashboard, ChevronDown, Home, ArrowLeft } from 'lucide-react';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { isAuthenticated, roles } = useAuth();

  const isAdmin = isAuthenticated && (roles.includes('ADMIN') || roles.includes('admin'));
  const isDashboardOrAdmin = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin');

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Minimal Header for Dashboard & Admin Consoles
  if (isDashboardOrAdmin) {
    return (
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || true
            ? 'bg-white/90 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-md shadow-slate-900/5 dark:shadow-cyan-950/10'
            : 'bg-transparent py-1 sm:py-2'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo & Home Navigation */}
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-2.5 group min-h-[44px] shrink-0" title="Return to Home Landing Page">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
                  <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[11px] flex items-center justify-center">
                    <Home className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                    Agent<span className="text-cyan-600 dark:text-cyan-400">Chain</span>
                  </span>
                  <span className="text-[9px] text-cyan-600 dark:text-cyan-400 font-mono flex items-center gap-0.5 group-hover:underline">
                    <ArrowLeft className="w-2.5 h-2.5" /> Back to Home
                  </span>
                </div>
              </Link>

              {/* Sub-Context Badge (Dashboard vs Admin) */}
              <div className="hidden xs:flex items-center space-x-2 pl-3 border-l border-slate-200 dark:border-slate-800">
                {pathname?.startsWith('/admin') ? (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    ADMIN CONSOLE
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                    USER DASHBOARD
                  </span>
                )}
              </div>
            </div>

            {/* Minimal Right Action Bar: Theme Switcher & Wallet */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {isAdmin && pathname?.startsWith('/dashboard') && (
                <Link
                  href="/admin"
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 font-mono text-xs font-bold hover:bg-amber-500/20 transition-colors min-h-[44px]"
                >
                  <span>Admin Console</span>
                </Link>
              )}
              {isAdmin && pathname?.startsWith('/admin') && (
                <Link
                  href="/dashboard"
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-mono text-xs font-bold hover:bg-cyan-500/20 transition-colors min-h-[44px]"
                >
                  <span>Dashboard</span>
                </Link>
              )}

              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all border border-slate-200 dark:border-slate-700/50 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Toggle Dark/Light Mode"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                </button>
              )}

              <ConnectButton />
            </div>
          </div>
        </div>
      </header>
    );
  }

  const primaryNavLinks = [
    { name: 'Marketplace', href: '/marketplace' },
  ];

  const secondaryNavLinks = [
    { name: 'How It Works', href: '/#how-it-works' },
    { name: 'Live Agents', href: '/#live-agents' },
    { name: 'Pricing & Split', href: '/#pricing' },
    { name: 'Trust & Security', href: '/#trust' },
    { name: 'Architecture', href: '/#architecture' },
  ];

  const allNavLinks = [...primaryNavLinks, ...secondaryNavLinks];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 shadow-md shadow-slate-900/5 dark:shadow-cyan-950/10'
          : 'bg-transparent py-1 sm:py-2'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group min-h-[44px] shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 p-[1px] shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 dark:text-cyan-400 group-hover:rotate-12 transition-transform duration-300" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
                Agent<span className="text-cyan-600 dark:text-cyan-400">Chain</span>
                <span className="hidden xs:inline-block text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 font-mono">v1.0</span>
              </span>
              <span className="hidden sm:block text-[9px] text-slate-500 dark:text-slate-400 tracking-wider font-mono">DECENTRALIZED WORKFORCE</span>
            </div>
          </Link>

          {/* Desktop Navigation Links (>=1280px: Full Row | 768px-1279px: Primary + "More" Dropdown) */}
          <nav className="hidden md:flex items-center space-x-3 lg:space-x-5">
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  className="text-xs lg:text-sm font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 shadow-sm min-h-[44px]"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-xs lg:text-sm font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 shadow-sm font-mono min-h-[44px]"
                  >
                    <span>Admin</span>
                  </Link>
                )}
              </>
            )}

            {/* Primary Nav Links */}
            {primaryNavLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-xs lg:text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors px-2 py-2 min-h-[44px] flex items-center"
              >
                {link.name}
              </Link>
            ))}

            {/* Secondary Links: Render directly on xl (>=1280px) */}
            <div className="hidden xl:flex items-center space-x-5">
              {secondaryNavLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors py-2 min-h-[44px] flex items-center"
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* Secondary Links: "More" Dropdown on md & lg (768px-1279px) */}
            <div className="relative xl:hidden" ref={dropdownRef}>
              <button
                onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                className="text-xs lg:text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center space-x-1 min-h-[44px]"
                aria-expanded={moreDropdownOpen}
              >
                <span>More</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 backdrop-blur-xl">
                  {secondaryNavLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      onClick={() => setMoreDropdownOpen(false)}
                      className="block px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 min-h-[44px] flex items-center"
                    >
                      {link.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Desktop Right Action Bar (>=768px) */}
          <div className="hidden md:flex items-center space-x-2.5 lg:space-x-3">
            {/* Theme Switcher Toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all border border-slate-200 dark:border-slate-700/50 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle Dark/Light Mode"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
            )}

            {/* Email Login Link if not logged in */}
            {!isAuthenticated && (
              <Link
                href="/login"
                className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center space-x-1.5 transition-colors min-h-[44px]"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Email Login</span>
              </Link>
            )}

            {/* RainbowKit Wallet Connect & SIWE Button */}
            <ConnectButton />
          </div>

          {/* Mobile Actions & Menu Toggle (<768px) */}
          <div className="flex md:hidden items-center space-x-2">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle Dark Mode"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation (<768px) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 pb-6 space-y-3 backdrop-blur-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
          {isAuthenticated && (
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-3 rounded-xl text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center gap-2 min-h-[44px]"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-3 rounded-xl text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 font-mono min-h-[44px]"
                >
                  <span>Admin Console</span>
                </Link>
              )}
            </div>
          )}

          {allNavLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3.5 py-3 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 min-h-[44px] flex items-center"
            >
              {link.name}
            </a>
          ))}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            {!isAuthenticated && (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 min-h-[44px]"
              >
                Email Login / Register
              </Link>
            )}
            <div className="flex justify-center pt-1">
              <ConnectButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}


