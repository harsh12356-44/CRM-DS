'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Check, X, LogOut, Shield, UserCheck, LayoutDashboard, UserCheck2, User, Save, Database, Loader2, Menu } from 'lucide-react';
import { NotificationItem } from '@/lib/types';

interface NavbarProps {
  currentRole?: string;
  onRoleChange?: (role: string) => void;
}

export default function Navbar({ currentRole = 'ADMIN' }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [saveToast, setSaveToast] = useState<{ show: boolean; msg: string; isError?: boolean }>({ show: false, msg: '' });

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const [activeUser, setActiveUser] = useState<{
    name: string;
    designation: string;
    initials: string;
    employeeId: string;
  }>({
    name: 'Ravina Khimani',
    designation: 'HR / COO',
    initials: 'RK',
    employeeId: 'RK001',
  });

  const loadActiveUser = async () => {
    try {
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_id') : null;
      const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_email') : null;
      const storedRole = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_role') : null;
      const res = await fetch(`/api/employees?t=${Date.now()}`);
      const data = await res.json();
      const employeesList: any[] = Array.isArray(data) ? data : data.employees || [];

      let currentEmp: any = null;

      if (storedId) {
        const cleanStoredId = storedId.toLowerCase().trim();
        currentEmp = employeesList.find((e: any) => (e.id && e.id.toLowerCase().trim() === cleanStoredId) || (e.employeeId && e.employeeId.toLowerCase().trim() === cleanStoredId));
      }

      if (!currentEmp && storedEmail) {
        const cleanStoredEmail = storedEmail.toLowerCase().trim();
        const prefix = cleanStoredEmail.split('@')[0];
        currentEmp = employeesList.find(
          (e: any) =>
            (e.email && e.email.toLowerCase().trim() === cleanStoredEmail) ||
            (e.email && e.email.toLowerCase().split('@')[0] === prefix) ||
            (e.name && e.name.toLowerCase().trim().includes(prefix))
        );
      }

      if (!currentEmp && storedEmail && (storedEmail.includes('meenal') || storedEmail.includes('mn005'))) {
        currentEmp = employeesList.find((e: any) => e.id === 'emp-5' || e.employeeId === 'MN005' || e.name.toLowerCase().includes('meenal'));
      }

      if (!currentEmp) {
        const effectiveRole = storedRole || currentRole;
        const matchingRoleEmps = employeesList.filter((e: any) => e.role === effectiveRole);
        currentEmp = matchingRoleEmps[0] || employeesList[0];
      }

      if (currentEmp) {
        const nameParts = currentEmp.name.trim().split(' ');
        const initials = nameParts.length > 1
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
          : currentEmp.name.slice(0, 2).toUpperCase();

        const newEmpId = currentEmp.employeeId || currentEmp.id;
        const newDesignation = currentEmp.designation || (currentEmp.role === 'ADMIN' ? 'HR / COO' : currentEmp.role === 'MANAGER' ? 'Senior Development Manager' : 'Employee');

        setActiveUser(prev => {
          if (prev.name === currentEmp.name && prev.employeeId === newEmpId && prev.designation === newDesignation) {
            return prev;
          }
          return {
            name: currentEmp.name,
            designation: newDesignation,
            initials,
            employeeId: newEmpId,
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    loadActiveUser();
    
    // Enforce permanent dark mode globally across all portals & roles
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('light');
      localStorage.removeItem('hrm_theme');
    }

    window.addEventListener('roleChange', loadActiveUser);
    window.addEventListener('employeeChanged', loadActiveUser);
    return () => {
      window.removeEventListener('roleChange', loadActiveUser);
      window.removeEventListener('employeeChanged', loadActiveUser);
    };
  }, [currentRole]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    document.cookie = 'hrm_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    document.cookie = 'hrm_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    document.cookie = 'hrm_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hrm_active_employee_id');
      localStorage.removeItem('hrm_active_employee_role');
      localStorage.removeItem('hrm_active_employee_email');
      localStorage.removeItem('hrm_active_employee_is_manager');
      window.location.href = '/login';
    }
  };

  const handleSaveDb = async () => {
    try {
      setSavingDb(true);
      const res = await fetch('/api/admin/save-db', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSaveToast({
          show: true,
          msg: `Database saved & backed up! (${data.stats.employees} Emps, ${data.stats.leaveRecords} Leaves)`,
          isError: false,
        });
      } else {
        setSaveToast({ show: true, msg: data.error || 'Failed to save database', isError: true });
      }
    } catch (err: any) {
      setSaveToast({ show: true, msg: err.message || 'Error saving database', isError: true });
    } finally {
      setSavingDb(false);
      setTimeout(() => {
        setSaveToast({ show: false, msg: '' });
      }, 5000);
    }
  };

  const setRoleCookie = (role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE') => {
    if (typeof window !== 'undefined') {
      const activeId = localStorage.getItem('hrm_active_employee_id');
      const isRavinaAdmin = activeId === 'emp-1' || activeId === 'rk001';

      if (isRavinaAdmin) {
        document.cookie = `hrm_user_role=ADMIN; path=/; max-age=86400`;
        localStorage.setItem('hrm_active_employee_role', 'ADMIN');
      } else {
        const safeRole = role === 'ADMIN' ? 'MANAGER' : role;
        document.cookie = `hrm_user_role=${safeRole}; path=/; max-age=86400`;
        localStorage.setItem('hrm_active_employee_role', safeRole);
      }
      window.dispatchEvent(new Event('roleChange'));
    }
  };

  const handleAccountSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
    setRoleCookie(val);
    const targetUrl = val === 'ADMIN' ? '/admin' : val === 'MANAGER' ? '/manager' : '/employee';
    window.location.href = targetUrl;
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeEmpId = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_id') : null;
  const storedRole = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_role') : null;
  const storedEmail = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_email') : null;

  const isAdminPage = pathname ? pathname.startsWith('/admin') : false;
  const isAdminRole = currentRole === 'ADMIN' || storedRole === 'ADMIN';
  const isAdminUser = activeEmpId === 'emp-1' || activeEmpId === 'rk001' || Boolean(storedEmail && (storedEmail.includes('ravina') || storedEmail.includes('admin') || storedEmail.includes('digitalsuncity') || storedEmail.includes('harshit')));

  const isRavinaUser = isAdminUser || isAdminRole;
  const isAdminAccount = isAdminPage || isAdminRole || isAdminUser || currentRole === 'ADMIN';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 sticky top-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-sm transition-colors duration-300">
      <div className="flex items-center space-x-2 sm:space-x-6">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('toggleMobileSidebar'));
            }
          }}
          className="p-2 -ml-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 md:hidden transition border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 cursor-pointer shrink-0"
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5 text-blue-500" />
        </button>

        <Link suppressHydrationWarning href={!mounted ? (currentRole === 'ADMIN' ? "/admin" : "/employee") : (isRavinaUser ? "/admin" : "/employee")} onClick={() => setRoleCookie(isRavinaUser ? 'ADMIN' : 'EMPLOYEE')} className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-base sm:text-lg shadow-md text-white shrink-0">
            H
          </div>
          <div>
            <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white font-heading">
              HRM Pilot
            </span>
            <span className="hidden xs:inline-block ml-1.5 sm:ml-2 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold uppercase tracking-wider">
              WP 1:1
            </span>
          </div>
        </Link>

        {/* Dynamic Portal Switcher Links (Strictly restricted to HR Admin Ravina) */}
        {isRavinaUser && (
          <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 space-x-1">
            <Link
              href="/admin"
              onClick={() => setRoleCookie('ADMIN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                pathname.startsWith('/admin')
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>HR Admin Suite</span>
            </Link>

            <Link
              href="/manager"
              onClick={() => setRoleCookie('MANAGER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                pathname === '/manager'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <UserCheck2 className="w-3.5 h-3.5" />
              <span>Manager Desk</span>
            </Link>

            <Link
              href="/employee"
              onClick={() => setRoleCookie('EMPLOYEE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                pathname === '/employee'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Employee Portal</span>
            </Link>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Authenticated Role Badge (Hidden on small mobile to preserve header room) */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
          {currentRole === 'ADMIN' ? (
            <Shield className="w-3.5 h-3.5 text-blue-600" />
          ) : (
            <UserCheck className="w-3.5 h-3.5 text-purple-600" />
          )}
          <span className="font-bold text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Role: <span className="text-slate-900 dark:text-white font-extrabold">{currentRole}</span>
          </span>
        </div>

        {/* Admin Save & Sync Database Button (Strictly for Admin Accounts) */}
        {isAdminAccount && (
          <button
            onClick={handleSaveDb}
            disabled={savingDb}
            className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs transition flex items-center space-x-1.5 sm:space-x-2 shadow-md border border-emerald-400/30 cursor-pointer active:scale-95 shrink-0"
            title="Click to save and backup all database records immediately"
          >
            {savingDb ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-emerald-100" />
            ) : (
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-100" />
            )}
            <span className="hidden sm:inline font-extrabold tracking-wide">{savingDb ? 'Saving...' : '💾 Save Database'}</span>
            <span className="sm:hidden font-extrabold text-[11px]">{savingDb ? '...' : 'Save'}</span>
          </button>
        )}

        {/* Floating Save Toast Notification */}
        {saveToast.show && (
          <div className={`fixed top-16 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center space-x-2 text-xs font-bold animate-in fade-in slide-in-from-top-3 ${
            saveToast.isError 
              ? 'bg-rose-500 text-white border-rose-600' 
              : 'bg-emerald-600 text-white border-emerald-500'
          }`}>
            <Check className="w-4 h-4" />
            <span>{saveToast.msg}</span>
          </div>
        )}

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifPopover(!showNotifPopover)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition relative border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Popover Tray */}
          {showNotifPopover && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Notifications Center</h4>
                <button onClick={() => setShowNotifPopover(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center py-4">No recent notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1 transition ${
                        n.isRead
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400'
                          : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-slate-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px] text-blue-600 dark:text-blue-400">{n.title}</span>
                        {!n.isRead && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded text-blue-600 dark:text-blue-400"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow ring-2 ring-blue-500/20">
            {activeUser.initials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
              {activeUser.name}
            </p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {activeUser.designation}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 transition text-xs flex items-center space-x-1.5 font-bold shadow-sm"
            title="Logout of session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
