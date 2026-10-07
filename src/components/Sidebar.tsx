'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserCheck2,
  Building2,
  Calendar,
  Upload,
  Download,
  Clock,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  FileCheck,
  DollarSign,
  Settings,
  ShieldAlert,
  UserCheck,
  User,
  Plane,
  FileText,
  ClipboardCheck,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Timer,
  UsersRound,
} from 'lucide-react';

interface SidebarProps {
  currentTab?: string;
  role?: string;
}

function SidebarContent({ currentTab, role }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams ? searchParams.get('tab') : null;
  const activeTab = activeTabParam || currentTab || 'dashboard';

  const [mounted, setMounted] = useState<boolean>(false);
  const [activeRole, setActiveRole] = useState<string>('ADMIN');
  const [isManager, setIsManager] = useState<boolean>(false);
  const [isWfh, setIsWfh] = useState<boolean>(false);
  const [empCodeDisplay, setEmpCodeDisplay] = useState<string>('NB002');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hrm_sidebar_collapsed');
      if (stored === 'true') {
        setIsCollapsed(true);
      }

      const handleToggle = () => setIsMobileOpen(prev => !prev);
      const handleOpen = () => setIsMobileOpen(true);
      const handleClose = () => setIsMobileOpen(false);

      window.addEventListener('toggleMobileSidebar', handleToggle);
      window.addEventListener('openMobileSidebar', handleOpen);
      window.addEventListener('closeMobileSidebar', handleClose);

      return () => {
        window.removeEventListener('toggleMobileSidebar', handleToggle);
        window.removeEventListener('openMobileSidebar', handleOpen);
        window.removeEventListener('closeMobileSidebar', handleClose);
      };
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const nextState = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('hrm_sidebar_collapsed', String(nextState));
      }
      return nextState;
    });
  };

  const getCookieRole = () => {
    if (typeof document === 'undefined') return 'ADMIN';
    const match = document.cookie.match(new RegExp('(^| )hrm_user_role=([^;]+)'));
    return match ? match[2] : 'ADMIN';
  };

  useEffect(() => {
    const updateSidebarData = async () => {
      const currentRole = role || getCookieRole();
      setActiveRole(currentRole);

        if (typeof window !== 'undefined') {
          const storedId = localStorage.getItem('hrm_active_employee_id');
          const storedEmail = localStorage.getItem('hrm_active_employee_email');
          const isMgr =
            localStorage.getItem('hrm_active_employee_is_manager') === 'true' ||
            localStorage.getItem('hrm_active_employee_role') === 'MANAGER' ||
            localStorage.getItem('hrm_active_employee_role') === 'ADMIN';
          setIsManager(isMgr);

          try {
            const res = await fetch(`/api/employees?t=${Date.now()}`);
            const data = await res.json();
            const employeesList: any[] = Array.isArray(data) ? data : data.employees || [];
            const emp = employeesList.find((e: any) =>
              (storedId && (e.id === storedId || e.employeeId === storedId || e.id.toLowerCase() === storedId.toLowerCase())) ||
              (storedEmail && e.email && e.email.toLowerCase().trim() === storedEmail.toLowerCase().trim()) ||
              (storedEmail && e.email && e.email.toLowerCase().split('@')[0] === storedEmail.toLowerCase().trim().split('@')[0]) ||
              (storedEmail && e.name && e.name.toLowerCase().includes(storedEmail.toLowerCase().trim().split('@')[0]))
            );
            setIsWfh(emp?.workMode === 'WFH');
            const newCode = emp ? (emp.employeeId || emp.id) : (storedId || 'EMP');
            setEmpCodeDisplay(prev => prev === newCode ? prev : newCode);
          } catch (e) {}
        }
    };

    updateSidebarData();

    window.addEventListener('roleChange', updateSidebarData);
    window.addEventListener('employeeChanged', updateSidebarData);
    return () => {
      window.removeEventListener('roleChange', updateSidebarData);
      window.removeEventListener('employeeChanged', updateSidebarData);
    };
  }, [role, pathname]);

  // Determine effective role based on current path and active user identity
  const storedEmpId = mounted && typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_id') : null;
  const isRavinaKhimani = !mounted || storedEmpId === 'emp-1' || storedEmpId === 'rk001' || !storedEmpId;

  const effectiveRole = isRavinaKhimani && pathname.startsWith('/admin')
    ? 'ADMIN'
    : pathname.startsWith('/manager')
    ? 'MANAGER'
    : 'EMPLOYEE';

  // 1. Admin Suite Sections (Strictly for Ravina Khimani)
  const adminSections = [
    {
      title: 'CORE MANAGEMENT',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
        { id: 'employees', label: 'Employees Roster', icon: Users, href: '/admin/employees' },
        { id: 'managers', label: 'Managers Desk', icon: UserCheck2, href: '/admin/managers' },
        { id: 'departments', label: 'Departments', icon: Building2, href: '/admin/departments' },
      ],
    },
    {
      title: 'ATTENDANCE & TIME',
      items: [
        { id: 'attendance', label: 'Attendance Grid', icon: Calendar, href: '/admin/attendance' },
        { id: 'attendance-import', label: 'Attendance Import', icon: Upload, href: '/admin/attendance/import' },
        { id: 'working-hours', label: 'Working Hours', icon: Clock, href: '/admin/working-hours' },
        { id: 'attendance-analytics', label: 'Attendance Analytics', icon: BarChart3, href: '/admin/attendance-analytics' },
        { id: 'time-tracking', label: 'Time Tracker', icon: Timer, href: '/admin/time-tracking' },
      ],
    },
    {
      title: 'LEAVES & PAYROLL',
      items: [
        { id: 'holidays', label: 'Holidays List', icon: CalendarDays, href: '/admin/holidays' },
        { id: 'leave-tracker', label: 'Leave Tracker', icon: FileSpreadsheet, href: '/admin/leave-tracker' },
        { id: 'leave-records', label: 'Leave Requests', icon: FileCheck, href: '/admin/leave-records' },
        { id: 'payroll', label: 'Payroll & Salary', icon: DollarSign, href: '/admin/payroll' },
      ],
    },
    {
      title: 'PORTALS & CONFIG',
      items: [
        { id: 'employee-portal', label: 'Employee Portal', icon: UserCheck, href: '/employee' },
        { id: 'manager-desk', label: 'Manager Desk', icon: UserCheck2, href: '/manager' },
        { id: 'audit-logs', label: 'System Audit Logs', icon: ShieldAlert, href: '/admin/audit-logs' },
        { id: 'settings', label: 'Settings Rules', icon: Settings, href: '/admin/settings' },
      ],
    },
  ];

  // 2. Employee & Manager Portal Menu Options
  const employeeSections = [
    {
      title: '',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/employee?tab=dashboard' },
        ...(!isWfh ? [{ id: 'attendance', label: 'Attendance', icon: Clock, href: '/employee?tab=attendance' }] : []),
        { id: 'time-tracker', label: 'Time Tracker', icon: Timer, href: '/employee?tab=time-tracker' },
        { id: 'apply-leave', label: 'Apply Leave', icon: Plane, href: '/employee?tab=apply-leave' },
        { id: 'leave-history', label: 'Leave History', icon: FileText, href: '/employee?tab=leave-history' },
        ...(isManager ? [{ id: 'team-approvals', label: 'Team Approvals', icon: ClipboardCheck, href: '/employee?tab=team-approvals' }] : []),
        ...(isManager ? [{ id: 'team-time', label: 'Team Time Tracker', icon: UsersRound, href: '/employee?tab=team-time' }] : []),
        ...(!isWfh ? [{ id: 'working-hours', label: 'Working Hours', icon: Clock, href: '/employee?tab=working-hours' }] : []),
        { id: 'holidays', label: 'Holidays List', icon: CalendarDays, href: '/employee?tab=holidays' },
        { id: 'notifications', label: 'Notifications', icon: Bell, href: '/employee?tab=notifications' },
        { id: 'profile', label: 'My Profile', icon: User, href: '/employee?tab=profile' },
      ],
    },
  ];

  const sections = effectiveRole === 'ADMIN' ? adminSections : employeeSections;

  return (
    <>
      {/* DESKTOP SIDEBAR (Visible on md screens and above) */}
      <aside
        suppressHydrationWarning
        className={`hidden md:flex flex-col justify-between ${
          isCollapsed ? 'w-20' : 'w-68'
        } bg-[#0f172a] light:bg-white border-r border-slate-800 light:border-slate-200 text-slate-200 light:text-slate-800 min-h-[calc(100vh-65px)] p-3.5 shrink-0 transition-all duration-300 ease-in-out relative group`}
      >
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-0.5 scrollbar-none">
          {/* Toggle Collapse Button Header Row */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center pb-2 border-b border-slate-800/80 light:border-slate-200' : 'justify-between pb-3 border-b border-slate-800/80 light:border-slate-200'} transition-all`}>
            {!isCollapsed && (
              <span className="text-xs font-black text-slate-300 light:text-slate-600 uppercase tracking-wider px-2">
                Menu Navigation
              </span>
            )}
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-xl bg-slate-800/80 light:bg-slate-100 hover:bg-blue-600/30 text-slate-300 light:text-slate-700 hover:text-white transition shadow-sm border border-slate-700/60 light:border-slate-200 cursor-pointer"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5 text-blue-400" /> : <PanelLeftClose className="w-5 h-5 text-slate-400" />}
            </button>
          </div>

          {/* Admin Quick Switch Back Banner (Strictly for Ravina Khimani when navigating outside Admin mode) */}
          {isRavinaKhimani && effectiveRole !== 'ADMIN' && (
            <Link
              href="/admin"
              title={isCollapsed ? 'Return to HR Admin Suite' : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'space-x-2 px-3.5 py-2.5'} bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-300 hover:bg-blue-600/30 transition text-xs font-bold shadow-md mb-2`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400 shrink-0" />
              {!isCollapsed && <span>← Return to HR Admin Suite</span>}
            </Link>
          )}

          {/* Brand Header for Portal View */}
          {effectiveRole !== 'ADMIN' && (
            <div className={`px-2 py-1 border-b border-slate-800/80 light:border-slate-200 mb-2 ${isCollapsed ? 'text-center' : ''}`}>
              <p className="text-sm font-black text-white light:text-slate-900 tracking-tight font-heading">
                {isCollapsed ? 'HRM' : 'PeopleFlow HRM'}
              </p>
              {!isCollapsed && <p className="text-[10px] text-slate-400 light:text-slate-500 uppercase tracking-wider font-bold">Employee Portal</p>}
            </div>
          )}

          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-1.5">
              {sec.title && !isCollapsed && (
                <div className="px-3 pt-2">
                  <p className="text-[11px] font-black tracking-wider text-slate-300 light:text-slate-600 uppercase">
                    {sec.title}
                  </p>
                </div>
              )}
              <nav className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const cleanHref = item.href.split('?')[0];
                  const isActive = activeTabParam
                    ? activeTabParam === item.id
                    : currentTab
                    ? currentTab === item.id
                    : cleanHref === '/admin' || cleanHref === '/employee'
                    ? pathname === cleanHref
                    : pathname === cleanHref || pathname.startsWith(cleanHref);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={`flex items-center ${
                        isCollapsed ? 'justify-center px-0 py-3' : 'space-x-3.5 px-3.5 py-2.5'
                      } rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                          : 'text-slate-200 light:text-slate-700 hover:text-white light:hover:text-slate-900 hover:bg-slate-800/80 light:hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-300 light:text-slate-600'}`} />
                      {!isCollapsed && <span className="truncate text-xs tracking-tight">{item.label}</span>}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer Employee ID Info Box */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80">
          {isCollapsed ? (
            <div
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-center items-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-white transition shadow-sm"
              title={`Employee ID: ${empCodeDisplay}`}
            >
              <User className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left space-y-0.5 shadow-sm">
              <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">Employee ID</p>
              <p className="text-xs font-mono font-extrabold text-slate-900 dark:text-white">{empCodeDisplay}</p>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE SLIDE-IN DRAWER (Rendered on phones & tablets < md) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 text-slate-100 flex flex-col justify-between p-4 shadow-2xl z-10 animate-in slide-in-from-left duration-200 h-full">
            <div>
              {/* Header with Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-sm text-white shadow-md">
                    H
                  </div>
                  <div>
                    <p className="font-extrabold text-sm text-white font-heading">HRM Pilot</p>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{effectiveRole} Menu</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 active:scale-95 transition"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Switch for Ravina Khimani */}
              {isRavinaKhimani && effectiveRole !== 'ADMIN' && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-300 hover:bg-blue-600/30 transition text-xs font-bold shadow-md my-2"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>← Return to HR Admin Suite</span>
                </Link>
              )}

              {/* Navigation Items */}
              <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-160px)] my-3 pr-1">
                {sections.map((sec, idx) => (
                  <div key={idx} className="space-y-1.5">
                    {sec.title && (
                      <div className="px-3 pt-1">
                        <p className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                          {sec.title}
                        </p>
                      </div>
                    )}
                    <nav className="space-y-1">
                      {sec.items.map((item) => {
                        const Icon = item.icon;
                        const cleanHref = item.href.split('?')[0];
                        const isActive = activeTabParam
                          ? activeTabParam === item.id
                          : currentTab
                          ? currentTab === item.id
                          : cleanHref === '/admin' || cleanHref === '/employee'
                          ? pathname === cleanHref
                          : pathname === cleanHref || pathname.startsWith(cleanHref);

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsMobileOpen(false)}
                            className={`flex items-center space-x-3.5 px-3.5 py-3 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                              isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                                : 'text-slate-200 hover:text-white hover:bg-slate-800/80 active:bg-slate-800'
                            }`}
                          >
                            <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="truncate text-xs tracking-tight">{item.label}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawer Footer with Safe Area */}
            <div className="pt-3 pb-safe border-t border-slate-800 text-xs flex items-center justify-between">
              <span className="text-slate-400 font-medium">ID: <strong className="font-mono text-white font-bold">{empCodeDisplay}</strong></span>
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">{effectiveRole}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Sidebar(props: SidebarProps) {
  return (
    <React.Suspense fallback={<aside className="w-68 bg-[#0f172a] border-r border-slate-800 shrink-0"></aside>}>
      <SidebarContent {...props} />
    </React.Suspense>
  );
}
