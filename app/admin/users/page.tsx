'use client';

import React from 'react';
import { UserTable } from '@/components/admin/UserTable';

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <UserTable />
    </div>
  );
}
