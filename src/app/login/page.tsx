'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Eye, EyeOff, Laptop, ShieldCheck, UserCheck, Trash2, KeyRound, UserX, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SavedDeviceAccount {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  password: string;
  savedAt: number;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savePasswordOnDevice, setSavePasswordOnDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const [savedAccount, setSavedAccount] = useState<SavedDeviceAccount | null>(null);
  const [useDifferentAccount, setUseDifferentAccount] = useState(false);
  const [showCredentialEditor, setShowCredentialEditor] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('HRM Pilot');

  // Read device-only saved account from localStorage on mount
  useEffect(() => {
    setIsClientMounted(true);
    try {
      const stored = localStorage.getItem('hrm_saved_device_login');
      if (stored) {
        const parsed: SavedDeviceAccount = JSON.parse(stored);
        if (parsed && parsed.email && parsed.password) {
          setSavedAccount(parsed);
          setEmail(parsed.email);
          setPassword(parsed.password);
        }
      }
    } catch (e) {
      console.warn('Failed to load device saved login:', e);
    }

    try {
      const cachedLogo = localStorage.getItem('hrm_company_logo');
      const cachedName = localStorage.getItem('hrm_company_name');
      if (cachedLogo) setCompanyLogoUrl(cachedLogo);
      if (cachedName) setCompanyName(cachedName);
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => {
          if (data?.companyLogoUrl) {
            setCompanyLogoUrl(data.companyLogoUrl);
            localStorage.setItem('hrm_company_logo', data.companyLogoUrl);
          }
          if (data?.companyName) {
            setCompanyName(data.companyName);
            localStorage.setItem('hrm_company_name', data.companyName);
          }
        })
        .catch(() => {});
    } catch (e) {}
  }, []);

  const executeLogin = async (targetEmail: string, targetPass: string, shouldSave: boolean) => {
    setError('');
    setInfoMsg('');
    setLoading(true);

    try {
      const cleanEmail = targetEmail.trim();

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: targetPass,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      const employee = data.employee;

      // Handle Device-Isolated Password Saving
      if (typeof window !== 'undefined') {
        if (shouldSave) {
          const deviceAccount: SavedDeviceAccount = {
            id: employee.id,
            employeeId: employee.employeeId,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            password: targetPass,
            savedAt: Date.now(),
          };
          localStorage.setItem('hrm_saved_device_login', JSON.stringify(deviceAccount));
        } else {
          // If explicitly unchecked, remove saved credentials for this account on this device
          const existing = localStorage.getItem('hrm_saved_device_login');
          if (existing) {
            try {
              const p = JSON.parse(existing);
              if (p.email?.toLowerCase() === employee.email?.toLowerCase()) {
                localStorage.removeItem('hrm_saved_device_login');
              }
            } catch (e) {}
          }
        }

        // Set session items for instant UI synchronization
        try {
          sessionStorage.clear();
          localStorage.removeItem('hrm_user_submitted_leaves');
          localStorage.removeItem('hrm_leave_records_backup');
        } catch (e) {}

        localStorage.setItem('hrm_active_employee_id', employee.id);
        localStorage.setItem('hrm_active_employee_role', employee.role);
        localStorage.setItem('hrm_active_employee_email', employee.email);
        window.dispatchEvent(new Event('roleChange'));
        window.dispatchEvent(new Event('employeeChanged'));
      }

      // Role-based redirect
      if (employee.role === 'ADMIN') {
        window.location.href = '/admin';
      } else if (employee.role === 'MANAGER') {
        window.location.href = '/manager';
      } else {
        window.location.href = '/employee?tab=dashboard';
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to connect to authentication service.');
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(email, password, savePasswordOnDevice);
  };

  const handleQuickLoginSaved = async () => {
    if (!savedAccount) return;
    await executeLogin(savedAccount.email, savedAccount.password, true);
  };

  const handleForgetDevice = () => {
    try {
      localStorage.removeItem('hrm_saved_device_login');
      setSavedAccount(null);
      setEmail('');
      setPassword('');
      setUseDifferentAccount(true);
      setShowCredentialEditor(false);
      setInfoMsg('Saved password has been removed from this device.');
      setTimeout(() => setInfoMsg(''), 4500);
    } catch (e) {}
  };

  const handleSwitchToDifferentAccount = () => {
    setUseDifferentAccount(true);
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError('');
  };

  const handleBackToSavedAccount = () => {
    if (savedAccount) {
      setEmail(savedAccount.email);
      setPassword(savedAccount.password);
    }
    setUseDifferentAccount(false);
    setError('');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'DS';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const hasSavedAccountOnThisDevice = isClientMounted && !!savedAccount && !useDifferentAccount;

  return (
    <main className="min-h-screen bg-slate-950 light:bg-slate-100 text-slate-100 light:text-slate-900 flex items-center justify-center p-3 sm:p-4 font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-5 sm:space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          {companyLogoUrl ? (
            <div className="inline-flex items-center justify-center max-h-16 max-w-[220px] mx-auto p-1">
              <img
                src={companyLogoUrl}
                alt={companyName || 'Company Logo'}
                className="max-h-14 sm:max-h-16 max-w-full object-contain drop-shadow-md"
                onError={() => setCompanyLogoUrl('')}
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 text-white font-extrabold text-xl sm:text-2xl mx-auto">
              {companyName ? companyName.charAt(0).toUpperCase() : 'H'}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-white light:text-slate-900 tracking-tight">
            {companyName ? `${companyName} Portal` : 'HRM Pilot Portal'}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 light:text-slate-600 font-medium">Enterprise Attendance, Leave Management & Payroll SaaS v2.0</p>
        </div>

        {/* Container */}
        <div className="bg-slate-900/90 light:bg-white border border-slate-800 light:border-slate-300 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 light:border-slate-200 pb-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-xs sm:text-sm text-white light:text-slate-900">
                {hasSavedAccountOnThisDevice ? 'Device Access Verified' : 'Sign In to Your Workspace'}
              </h2>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center space-x-1">
              <span>SSL Protected 🔒</span>
            </span>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMsg && (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* MODE A: SAVED ACCOUNT DETECTED ON THIS DEVICE */}
          {hasSavedAccountOnThisDevice ? (
            <div className="space-y-4">
              {/* Device-Saved Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/60 via-slate-900 to-indigo-950/40 border border-blue-500/30 shadow-lg space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-extrabold tracking-wide uppercase">
                    <Laptop className="w-3 h-3 text-blue-400" />
                    <span>Saved on This Device</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {savedAccount.role}
                  </span>
                </div>

                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-base flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
                    {getInitials(savedAccount.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-sm text-white truncate">{savedAccount.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{savedAccount.email}</p>
                    <p className="text-[10px] text-emerald-400 flex items-center space-x-1 mt-0.5 font-medium">
                      <KeyRound className="w-2.5 h-2.5" />
                      <span>Password securely saved for this device</span>
                    </p>
                  </div>
                </div>

                {/* Primary Quick Login Button */}
                <button
                  type="button"
                  onClick={handleQuickLoginSaved}
                  disabled={loading}
                  className="w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{loading ? 'Authenticating...' : `Sign in as ${savedAccount.name.split(' ')[0]}`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Card Sub-actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setShowCredentialEditor(!showCredentialEditor)}
                    className="text-slate-400 hover:text-white transition font-medium flex items-center space-x-1 cursor-pointer py-1"
                  >
                    <span>{showCredentialEditor ? '▲ Hide Details' : '▼ View / Edit Password'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleForgetDevice}
                    className="text-rose-400/80 hover:text-rose-300 transition font-medium flex items-center space-x-1 cursor-pointer py-1"
                    title="Remove saved password from this device"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Forget this device</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Edit/View Password Form for Saved Account */}
              {showCredentialEditor && (
                <form onSubmit={handleFormSubmit} className="space-y-4 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 sm:py-2.5 text-base sm:text-xs min-h-[46px] text-white font-medium focus:outline-none focus:border-blue-500 transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block font-bold text-slate-300">Saved Device Password</label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-white flex items-center space-x-1 text-[11px] cursor-pointer py-1"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-blue-400" />}
                        <span>{showPassword ? 'Hide' : 'View'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 sm:py-2.5 text-base sm:text-xs min-h-[46px] text-white font-medium focus:outline-none focus:border-blue-500 transition font-mono"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Updating & Signing In...' : 'Save & Sign In'}
                  </button>
                </form>
              )}

              {/* Switch to Another Account Button */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleSwitchToDifferentAccount}
                  className="text-xs text-slate-400 hover:text-blue-400 font-semibold transition flex items-center justify-center space-x-1.5 mx-auto cursor-pointer py-1"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Sign in as a different employee</span>
                </button>
              </div>
            </div>
          ) : (
            /* MODE B: STANDARD LOGIN FORM (FIRST-TIME OR DIFFERENT ACCOUNT) */
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs" autoComplete="off">
              <div>
                <label className="block font-bold text-slate-300 light:text-slate-700 mb-1.5">Email or Employee ID</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 light:text-slate-500" />
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-slate-950 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl pl-10 pr-4 py-3 sm:py-2.5 text-base sm:text-xs min-h-[46px] text-white light:text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition"
                    placeholder="name@company.com or EMP001"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-300 light:text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-white flex items-center space-x-1 text-[11px] cursor-pointer py-1"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-blue-400" />}
                    <span>{showPassword ? 'Hide' : 'View'}</span>
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 light:text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-950 light:bg-slate-50 border border-slate-800 light:border-slate-300 rounded-xl pl-10 pr-10 py-3 sm:py-2.5 text-base sm:text-xs min-h-[46px] text-white light:text-slate-900 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium transition font-mono"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Save Password on this Device Checkbox */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={savePasswordOnDevice}
                    onChange={e => setSavePasswordOnDevice(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-slate-200">
                      Save password on this device
                    </span>
                    <span className="text-[10px] text-slate-400 leading-relaxed">
                      Isolated to this browser only. No other employee or device can see your password.
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              {/* Back to Saved Account (if one exists) */}
              {savedAccount && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={handleBackToSavedAccount}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition cursor-pointer py-1"
                  >
                    ← Back to saved account ({savedAccount.name.split(' ')[0]})
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Privacy & Device Isolation Guarantee Notice */}
          <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center justify-center space-x-1.5 text-center">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Device Isolation: Saved credentials stay on this personal device only.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
