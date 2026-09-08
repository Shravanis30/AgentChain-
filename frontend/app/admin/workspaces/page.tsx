'use client';

import React from 'react';
import { WorkspaceMonitor } from '@/components/admin/WorkspaceMonitor';

export default function AdminWorkspacesPage() {
  return (
    <div className="space-y-6">
      <WorkspaceMonitor />
    </div>
  );
}
