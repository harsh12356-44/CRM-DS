'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import BranchesTab from '@/components/BranchesTab';

export default function AdminBranchesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="branches" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          <BranchesTab />
        </main>
      </div>
    </div>
  );
}
