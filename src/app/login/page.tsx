'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Mail, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('ravina@hrmpilot.com');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectRole = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError('');
  };

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

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-300 light:text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 light:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-950 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:border-blue-500 light:focus:border-blue-600 font-medium transition"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-300 light:text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 light:text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-950 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:border-blue-500 light:focus:border-blue-600 font-medium transition"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </form>

          {/* Quick Demo Credentials Switcher */}
          <div className="pt-4 border-t border-slate-800 light:border-slate-200 space-y-2">
            <p className="text-[11px] font-black text-slate-400 light:text-slate-600 text-center uppercase tracking-wider">
              Quick Role Sign-In Presets
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSelectRole('ravina@hrmpilot.com', 'Admin@123')}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition ${
                  email === 'ravina@hrmpilot.com'
                    ? 'bg-blue-600/20 light:bg-blue-100 border-blue-500 light:border-blue-400 text-white light:text-blue-900'
                    : 'bg-slate-950/60 light:bg-slate-100 border-slate-800 light:border-slate-300 text-slate-400 light:text-slate-700 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Shield className="w-3.5 h-3.5 text-blue-400 light:text-blue-600" />
                  {email === 'ravina@hrmpilot.com' && <CheckCircle2 className="w-3 h-3 text-blue-400 light:text-blue-600" />}
                </div>
                <p className="font-extrabold text-[11px] text-white light:text-slate-900">HR / COO</p>
                <p className="text-[9px] text-slate-400 light:text-slate-600 truncate font-semibold">Ravina Khimani</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('naman@hrmpilot.com', 'Manager@123')}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition ${
                  email === 'naman@hrmpilot.com'
                    ? 'bg-purple-600/20 light:bg-purple-100 border-purple-500 light:border-purple-400 text-white light:text-purple-900'
                    : 'bg-slate-950/60 light:bg-slate-100 border-slate-800 light:border-slate-300 text-slate-400 light:text-slate-700 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <UserCheck className="w-3.5 h-3.5 text-purple-400 light:text-purple-600" />
                  {email === 'naman@hrmpilot.com' && <CheckCircle2 className="w-3 h-3 text-purple-400 light:text-purple-600" />}
                </div>
                <p className="font-extrabold text-[11px] text-white light:text-slate-900">Dev Manager</p>
                <p className="text-[9px] text-slate-400 light:text-slate-600 truncate font-semibold">Naman Bangia</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('sonu@hrmpilot.com', 'Employee@123')}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition ${
                  email === 'sonu@hrmpilot.com'
                    ? 'bg-emerald-600/20 light:bg-emerald-100 border-emerald-500 light:border-emerald-400 text-white light:text-emerald-900'
                    : 'bg-slate-950/60 light:bg-slate-100 border-slate-800 light:border-slate-300 text-slate-400 light:text-slate-700 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 light:text-emerald-600" />
                  {email === 'sonu@hrmpilot.com' && <CheckCircle2 className="w-3 h-3 text-emerald-400 light:text-emerald-600" />}
                </div>
                <p className="font-extrabold text-[11px] text-white light:text-slate-900">Developer</p>
                <p className="text-[9px] text-slate-400 light:text-slate-600 truncate font-semibold">Sonu Goswami</p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectRole('sudeshna@hrmpilot.com', 'Employee@123')}
                className={`p-2.5 rounded-xl border text-left space-y-1 transition ${
                  email === 'sudeshna@hrmpilot.com'
                    ? 'bg-pink-600/20 light:bg-pink-100 border-pink-500 light:border-pink-400 text-white light:text-pink-900'
                    : 'bg-slate-950/60 light:bg-slate-100 border-slate-800 light:border-slate-300 text-slate-400 light:text-slate-700 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <UserCheck className="w-3.5 h-3.5 text-pink-400 light:text-pink-600" />
                  {email === 'sudeshna@hrmpilot.com' && <CheckCircle2 className="w-3 h-3 text-pink-400 light:text-pink-600" />}
                </div>
                <p className="font-extrabold text-[11px] text-white light:text-slate-900">WFH Designer</p>
                <p className="text-[9px] text-slate-400 light:text-slate-600 truncate font-semibold">Sudeshna Pyne</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
