'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { Bot, ArrowLeft, Loader2 } from 'lucide-react';
import { CreateAgentForm } from '@/components/agents/CreateAgentForm';

export default function CreateAgentPage() {
  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center space-x-2 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Agents</span>
        </Link>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Create New AI Agent</span>
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              Configure system prompts, LLM parameters, tool permissions, or repository source
            </p>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <Suspense
        fallback={
          <div className="p-8 text-center font-mono space-y-2">
            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Loading agent builder...</p>
          </div>
        }
      >
        <CreateAgentForm />
      </Suspense>
    </div>
  );
}
