'use client';

import React from 'react';
import { BillingHistory } from '@/components/dashboard/BillingHistory';

export default function BillingInvoicesPage() {
  return (
    <div className="space-y-6">
      <BillingHistory />
    </div>
  );
}
