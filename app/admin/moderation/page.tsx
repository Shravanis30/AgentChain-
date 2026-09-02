'use client';

import React from 'react';
import { ModerationQueue } from '@/components/admin/ModerationQueue';

export default function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <ModerationQueue />
    </div>
  );
}
