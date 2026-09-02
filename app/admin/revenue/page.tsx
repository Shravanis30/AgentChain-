'use client';

import React from 'react';
import { RevenueLedger } from '@/components/admin/RevenueLedger';

export default function AdminRevenuePage() {
  return (
    <div className="space-y-6">
      <RevenueLedger />
    </div>
  );
}
