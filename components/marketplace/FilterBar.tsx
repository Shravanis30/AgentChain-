'use client';

import React from 'react';
import { Search, SlidersHorizontal, RotateCcw, ArrowUpDown } from 'lucide-react';
import { MarketplaceFilterParams } from '@/lib/api/marketplace';

interface FilterBarProps {
  filters: MarketplaceFilterParams;
  onChange: (updatedFilters: MarketplaceFilterParams) => void;
  onReset: () => void;
}

export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const categories = ['All', 'Security Audit', 'DeFi & Trading', 'Code Quality', 'Data Mining', 'Database Ops'];

  return (
    <div className="p-4 sm:p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
      {/* Top Search & Sort Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full sm:w-96">
          <label htmlFor="marketplace-search-input" className="sr-only">
            Search Marketplace Agents
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="marketplace-search-input"
            type="text"
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value, offset: 0 })}
            placeholder="Search agents by name, tag, or function..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm"
          />
        </div>

        {/* Sort Dropdown & Reset */}
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
          <div className="flex items-center space-x-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <label htmlFor="marketplace-sort-select" className="sr-only">
              Sort Order
            </label>
            <select
              id="marketplace-sort-select"
              value={filters.sort_by || 'newest'}
              onChange={(e) => onChange({ ...filters, sort_by: e.target.value as any, offset: 0 })}
              className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 font-mono"
            >
              <option value="newest">Newest First</option>
              <option value="rating">Highest Rated</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          <button
            onClick={onReset}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs font-mono flex items-center gap-1"
            title="Reset Filters"
            aria-label="Reset all search and price filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Category Pills & Price Inputs Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800/60">
        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {categories.map((cat) => {
            const isActive =
              (cat === 'All' && (!filters.category || filters.category === 'All')) ||
              filters.category?.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                onClick={() => onChange({ ...filters, category: cat, offset: 0 })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Price Range Filter */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Price (USDC):</span>
          <input
            type="number"
            placeholder="Min"
            min="0"
            value={filters.min_price !== undefined ? filters.min_price : ''}
            onChange={(e) =>
              onChange({
                ...filters,
                min_price: e.target.value ? parseFloat(e.target.value) : undefined,
                offset: 0,
              })
            }
            className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
          />
          <span>-</span>
          <input
            type="number"
            placeholder="Max"
            min="0"
            value={filters.max_price !== undefined ? filters.max_price : ''}
            onChange={(e) =>
              onChange({
                ...filters,
                max_price: e.target.value ? parseFloat(e.target.value) : undefined,
                offset: 0,
              })
            }
            className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
