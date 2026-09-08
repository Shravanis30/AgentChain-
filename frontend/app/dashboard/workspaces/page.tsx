'use client';

import React from 'react';
import { WorkspaceTable } from '@/components/dashboard/WorkspaceTable';

export default function MyWorkspacesPage() {
  return (
    <div className="space-y-6">
      <WorkspaceTable />
    </div>
  );
}
