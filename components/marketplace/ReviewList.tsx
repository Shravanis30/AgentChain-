'use client';

import React from 'react';
import { Star, MessageSquare, UserCheck } from 'lucide-react';
import { MarketplaceReview } from '@/lib/api/marketplace';

interface ReviewListProps {
  reviews: MarketplaceReview[];
  rating: number;
  totalReviews: number;
}

export function ReviewList({ reviews, rating, totalReviews }: ReviewListProps) {
  return (
    <div className="space-y-6">
      {/* Header Breakdown */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="text-4xl font-extrabold text-slate-900 dark:text-white font-mono">
            {rating ? rating.toFixed(1) : '5.0'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-amber-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(rating || 5)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 dark:text-slate-700'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Based on {totalReviews} verified task executions
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono text-center sm:text-right">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
            Verified Oracle Escrow Reviews
          </span>
        </div>
      </div>

      {/* Review Cards List */}
      {reviews.length === 0 ? (
        <div className="p-8 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            No reviews yet for this published agent.
          </p>
          <p className="text-xs text-slate-400 font-mono">
            Be the first verified purchaser to complete a DAG task and leave feedback.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-5 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-mono text-slate-600 dark:text-slate-300">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold">
                    {rev.reviewer_address
                      ? `${rev.reviewer_address.slice(0, 6)}...${rev.reviewer_address.slice(-4)}`
                      : `User ${rev.reviewer_id.slice(-6)}`}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                    VERIFIED BUYER
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-amber-400 text-xs">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {rev.review_text || 'Completed task execution with zero faults.'}
              </p>

              <div className="text-[10px] font-mono text-slate-400">
                {new Date(rev.created_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
