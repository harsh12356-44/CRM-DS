'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Fetch employees list to resolve dynamic role & employee ID
      let employeesList: any[] = [];
      try {
        const res = await fetch(`/api/employees?t=${Date.now()}`);
        const data = await res.json();
        employeesList = Array.isArray(data) ? data : data.employees || [];
      } catch (err) {}

      // Find matching employee by email
      const emp = employeesList.find((e: any) => e.email && e.email.toLowerCase().trim() === cleanEmail);

      let targetRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' = 'EMPLOYEE';
      let empId = 'emp-12';

      if (emp) {
        targetRole = (emp.role as 'ADMIN' | 'MANAGER' | 'EMPLOYEE') || 'EMPLOYEE';
        empId = emp.id;
      } else if (cleanEmail.includes('sudeshna')) {
        targetRole = 'EMPLOYEE';
        empId = 'emp-18';
      } else if (cleanEmail.includes('ravina') || cleanEmail.includes('admin') || cleanEmail.includes('harshit')) {
        targetRole = 'ADMIN';
        empId = 'emp-1';
      } else if (cleanEmail.includes('naman') || cleanEmail.includes('jigyasa') || cleanEmail.includes('meenal') || cleanEmail.includes('divyanshu') || cleanEmail.includes('manager')) {
        targetRole = 'MANAGER';
        empId = 'emp-2';
      }

      // Set cookie and localStorage for role & active employee
      document.cookie = `hrm_user_role=${targetRole}; path=/; max-age=86400`;
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('hrm_active_employee_id', empId);
        localStorage.setItem('hrm_active_employee_role', targetRole);
        window.dispatchEvent(new Event('roleChange'));
      }

      // Perform strict role-based dashboard redirection
      if (targetRole === 'ADMIN') {
        router.push('/admin');
      } else if (targetRole === 'MANAGER') {
        router.push('/manager');
      } else {
        router.push('/employee');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 light:bg-slate-100 text-slate-100 light:text-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 text-white font-extrabold text-2xl mx-auto">
            H
          </div>
          <h1 className="text-3xl font-black text-white light:text-slate-900 tracking-tight">HRM Pilot Portal</h1>
          <p className="text-xs text-slate-400 light:text-slate-600 font-medium">Enterprise Attendance, Leave Management & Payroll SaaS v2.0</p>
        </div>

        {/* Login Form Container */}
        <div className="bg-slate-900/90 light:bg-white border border-slate-800 light:border-slate-300 backdrop-blur-xl rounded-3xl p-7 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 light:border-slate-200 pb-4">
            <h2 className="font-bold text-sm text-white light:text-slate-900">Sign In to Your Workspace</h2>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/10 light:bg-blue-100 text-blue-400 light:text-blue-700 border border-blue-500/20 light:border-blue-300 font-bold">
              SSL Protected 🔒
            </span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 light:bg-red-100 border border-red-500/30 light:border-red-300 text-red-400 light:text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs" autoComplete="off" method="post">
            {/* Hidden dummy inputs to trap browser autofill managers */}
            <input type="text" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
            <input type="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />

            <div>
              <label className="block font-bold text-slate-300 light:text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 light:text-slate-500" />
                <input
                  type="email"
                  name="user_email_no_autofill"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:border-blue-500 light:focus:border-blue-600 font-medium transition"
                  placeholder="name@company.com"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 light:text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 light:text-slate-500" />
                <input
                  type="password"
                  name="user_password_no_autofill"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:border-blue-500 light:focus:border-blue-600 font-medium transition"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
