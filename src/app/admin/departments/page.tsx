'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import DepartmentsTab from '@/components/DepartmentsTab';

export default function AdminDepartmentsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="departments" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          <DepartmentsTab />
        </main>
      </div>
    </div>
  );
}
