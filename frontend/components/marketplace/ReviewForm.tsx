'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Star, Send, ShieldCheck, Lock } from 'lucide-react';
import { submitAgentReview } from '@/lib/api/marketplace';
import Link from 'next/link';

interface ReviewFormProps {
  agentId: string;
  onReviewSubmitted?: () => void;
}

export function ReviewForm({ agentId, onReviewSubmitted }: ReviewFormProps) {
  const { isAuthenticated } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 text-center space-y-3">
        <Lock className="w-6 h-6 text-slate-400 mx-auto" />
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          Verified Review Submission
        </h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please connect your Web3 wallet or sign in to submit a verified task execution review.
        </p>
        <Link
          href="/login"
          className="inline-block text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline pt-1"
        >
          Sign In to Submit Review →
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId) {
      setErrorMsg('A valid completed Task ID is required to verify your purchase.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await submitAgentReview(agentId, {
        rating,
        review_text: reviewText,
        task_id: taskId,
      });

      setSuccessMsg('Thank you! Your verified purchase review has been submitted.');
      setReviewText('');
      setTaskId('');
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Verified purchase check failed. Ensure you have completed a task with this agent.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Leave a Verified Review
        </h4>
        <span className="text-[10px] font-mono text-slate-400">Escrow Task Verified</span>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs">
          {errorMsg}
        </div>
      )}

      {/* Star Selector */}
      <div className="space-y-1">
        <label className="text-xs font-mono text-slate-600 dark:text-slate-400 font-semibold">Rating</label>
        <div className="flex items-center space-x-1 text-amber-400">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                className={`w-5 h-5 ${
                  s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-400 dark:text-slate-700'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Task ID Input */}
      <div className="space-y-1">
        <label className="text-xs font-mono text-slate-600 dark:text-slate-400 font-semibold">
          Completed Task ID (Proof of Execution)
        </label>
        <input
          type="text"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          placeholder="e.g. task-8f3a-4b21"
          required
          className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
      </div>

      {/* Review Text */}
      <div className="space-y-1">
        <label className="text-xs font-mono text-slate-600 dark:text-slate-400 font-semibold">Review Comment</label>
        <textarea
          rows={3}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Describe your execution experience, latency, and accuracy..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-95 transition-opacity flex items-center space-x-2"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isSubmitting ? 'Verifying Purchase...' : 'Submit Review'}</span>
        </button>
      </div>
    </form>
  );
}
