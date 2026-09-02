'use client';

import React from 'react';
import { SystemHealthPanel } from '@/components/admin/SystemHealthPanel';

export default function AdminSystemPage() {
  return (
    <div className="space-y-6">
      <SystemHealthPanel />
    </div>
  );
}
