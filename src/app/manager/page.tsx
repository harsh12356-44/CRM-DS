'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Users, CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { LeaveRecord, Employee, mergeLeavesNonRegressive, getLeaveTimestamp } from '@/lib/types';

export default function ManagerPortalPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [activeManager, setActiveManager] = useState<Employee | null>(null);
  const [filterMode, setFilterMode] = useState<'MY_TEAM' | 'ALL'>('MY_TEAM');

  const fetchManagerData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [leaveRes, empRes] = await Promise.all([
        fetch(`/api/leaves?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/employees?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const leaveData = await leaveRes.json();
      const empData = await empRes.json();

      const serverLeaves: LeaveRecord[] = Array.isArray(leaveData) ? leaveData : leaveData.records || [];
      const empList: Employee[] = Array.isArray(empData) ? empData : empData.employees || [];

      setLeaves(serverLeaves);
      setEmployees(empList);

      if (typeof window !== 'undefined') {
        const storedId = localStorage.getItem('hrm_active_employee_id');
        const storedEmail = localStorage.getItem('hrm_active_employee_email');
        const mgr = empList.find(e =>
          (storedId && (e.id === storedId || e.employeeId === storedId || e.id.toLowerCase() === storedId.toLowerCase())) ||
          (storedEmail && e.email && e.email.toLowerCase().trim() === storedEmail.toLowerCase().trim()) ||
          (storedEmail && e.email && e.email.toLowerCase().split('@')[0] === storedEmail.toLowerCase().trim().split('@')[0]) ||
          (storedEmail && e.name && e.name.toLowerCase().includes(storedEmail.toLowerCase().trim().split('@')[0])) ||
          (storedEmail && (storedEmail.includes('meenal') || storedEmail.includes('mn005')) && e.id === 'emp-5')
        ) || (storedEmail && (storedEmail.includes('meenal') || storedEmail.includes('mn005')) ? empList.find(e => e.id === 'emp-5') : null) || empList.find(e => e.role === 'MANAGER') || null;
        setActiveManager(mgr);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  const displayedLeaves = leaves.filter(l => {
    if (filterMode === 'ALL') return true;
    if (!activeManager) return true;

    const emp = employees.find(
      e => e.id === l.employeeId || e.employeeId === l.employeeId || e.name === l.employeeId
    );

    if (!emp) return true;

    const mgrNameLower = activeManager.name.toLowerCase().trim();
    const mgrFirstName = mgrNameLower.split(' ')[0];

    const isDirectSubordinate =
      (emp.primaryManager && (emp.primaryManager.toLowerCase().includes(mgrNameLower) || emp.primaryManager.toLowerCase().includes(mgrFirstName))) ||
      (emp.secondaryManager && (emp.secondaryManager.toLowerCase().includes(mgrNameLower) || emp.secondaryManager.toLowerCase().includes(mgrFirstName)));

    const isSameDepartment = Boolean(
      emp.department && activeManager.department && emp.department.toLowerCase().trim() === activeManager.department.toLowerCase().trim()
    );

    return isDirectSubordinate || isSameDepartment;
  });

  useEffect(() => {
    fetchManagerData(false);

    const handleUpdate = () => fetchManagerData(true);
    window.addEventListener('leaveDataUpdated', handleUpdate);

    const interval = setInterval(() => {
      fetchManagerData(true);
    }, 3000);

    return () => {
      window.removeEventListener('leaveDataUpdated', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchManagerData]);

  const handleManagerAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    // 1. Instant Optimistic UI Update (0ms latency response)
    const newManagerStatus = action === 'APPROVED' ? 'Approved' : 'Rejected';
    const newStatus = action === 'REJECTED' ? 'REJECTED' : undefined;

    const targetRecord = (leaves || []).find(l => l.id === id);
    const updatedTargetRecord = targetRecord
      ? {
          ...targetRecord,
          managerStatus: newManagerStatus,
          status: (newManagerStatus === 'Approved' && targetRecord.hrStatus === 'Approved') ? 'APPROVED' : newStatus || targetRecord.status,
        }
      : undefined;

    setLeaves(prev =>
      prev.map(l => {
        if (l.id === id) {
          const isBothApproved = newManagerStatus === 'Approved' && l.hrStatus === 'Approved';
          return {
            ...l,
            managerStatus: newManagerStatus,
            status: isBothApproved ? 'APPROVED' : newStatus || l.status,
          };
        }
        return l;
      })
    );

    setStatusMsg(`Manager decision recorded: ${action}! ${action === 'APPROVED' ? 'Awaiting HR final approval.' : 'Request rejected.'}`);

    try {
      const res = await fetch('/api/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          record: updatedTargetRecord,
          status: action,
          approverRole: 'MANAGER',
        }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('leaveDataUpdated'));
        }
      } else {
        const data = await res.json();
        setStatusMsg(`Failed: ${data.error || 'Could not update'}`);
        fetchManagerData();
      }
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setStatusMsg('Failed to process manager action.');
      fetchManagerData();
    }
  };

  const getAdminStatusText = (l: LeaveRecord) => {
    if (l.hrStatus === 'Approved' || l.status === 'APPROVED') return 'Approved ✓';
    if (l.hrStatus === 'Rejected' || l.status === 'REJECTED') return 'Rejected ✗';
    return 'Pending HR Action';
  };

  const getFinalBadge = (l: LeaveRecord) => {
    if (l.status === 'APPROVED' || (l.managerStatus === 'Approved' && l.hrStatus === 'Approved')) {
      return (
        <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold text-[10px] uppercase tracking-wider whitespace-nowrap inline-flex items-center shadow-sm">
          HR AND MANAGER HAVE APPROVED ✓
        </span>
      );
    }
    if (l.status === 'REJECTED' || l.managerStatus === 'Rejected' || l.hrStatus === 'Rejected') {
      return (
        <span className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-extrabold text-[10px] uppercase tracking-wider whitespace-nowrap inline-flex items-center shadow-sm">
          REJECTED ✗
        </span>
      );
    }
    if (l.managerStatus === 'Approved') {
      return (
        <span className="px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-extrabold text-[10px] uppercase tracking-wider whitespace-nowrap inline-flex items-center shadow-sm">
          APPROVED BY MANAGER (AWAITING HR)
        </span>
      );
    }
    return (
      <span className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold text-[10px] uppercase tracking-wider whitespace-nowrap inline-flex items-center shadow-sm">
        PENDING MANAGER REVIEW
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="MANAGER" />
      <div className="flex flex-1">
        <Sidebar currentTab="manager-desk" role="MANAGER" />
        <main className="flex-1 p-4 md:p-8 w-full space-y-6 overflow-y-auto overflow-x-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Manager Approval & Subordinate Leave Desk</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Active Manager Account: <strong className="text-indigo-300 font-bold">{activeManager ? `${activeManager.name} (${activeManager.designation || 'Manager'})` : 'Meenal (SEO Manager)'}</strong> — Review subordinate leave applications and monitor real-time HR final decisions.
              </p>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 bg-indigo-950/60 border border-indigo-500/40 rounded-xl text-xs text-indigo-200 font-medium flex items-center justify-between animate-fadeIn">
              <span>{statusMsg}</span>
              <button onClick={() => setStatusMsg('')} className="text-indigo-400 font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* Subordinate Leave Applications Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-4 p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Subordinate Leave Requests Register</span>
              </h3>

              <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                <button
                  onClick={() => setFilterMode('MY_TEAM')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterMode === 'MY_TEAM' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  👥 My Team Subordinates ({activeManager ? activeManager.name : 'Meenal'})
                </button>
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`px-3 py-1 rounded-lg transition ${
                    filterMode === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🏢 All Company Requests
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 whitespace-nowrap">Request ID</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Subordinate</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Dates & Leave Type</th>
                    <th className="py-3.5 px-4">Reason / Details</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Your Manager Status</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">HR / Admin Status</th>
                    <th className="py-3.5 px-4 text-center whitespace-nowrap">Final Status</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Manager Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Loading team leave requests...
                      </td>
                    </tr>
                  ) : displayedLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No team leave applications found for {filterMode === 'MY_TEAM' ? 'your direct team' : 'this selection'}.
                      </td>
                    </tr>
                  ) : (
                    displayedLeaves.map(l => {
                      const emp = employees.find(
                        e => e.id === l.employeeId || e.employeeId === l.employeeId || e.name === l.employeeId
                      );

                      return (
                        <tr key={l.id} className="hover:bg-slate-850 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-400 whitespace-nowrap">
                            #{l.id.replace(/[^0-9]/g, '').slice(-3) || l.id.slice(-3)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <strong className="text-white block font-bold">{emp ? emp.name : l.employeeId}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {emp?.employeeId || l.employeeId}</span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-purple-300">{l.leaveType}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {l.startDate === l.endDate || !l.endDate ? l.startDate : `${l.startDate} to ${l.endDate}`} ({l.daysCount || 1} {l.daysCount === 1 ? 'day' : 'days'})
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 min-w-[150px]">
                            {l.note || 'Leave application'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300 whitespace-nowrap">
                            {l.managerStatus || (l.status === 'APPROVED' ? 'Approved' : 'Pending')}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300 whitespace-nowrap">
                            {getAdminStatusText(l)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {getFinalBadge(l)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {l.managerStatus !== 'Approved' && l.managerStatus !== 'Rejected' && l.status !== 'APPROVED' && l.status !== 'REJECTED' ? (
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => handleManagerAction(l.id, 'APPROVED')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition shadow flex items-center space-x-1 cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleManagerAction(l.id, 'REJECTED')}
                                  className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-[11px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end space-x-1.5">
                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                                  l.managerStatus === 'Approved' || l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
                                }`}>
                                  {l.managerStatus === 'Approved' || l.status === 'APPROVED' ? '✓ Manager Approved' : '✗ Manager Rejected'}
                                </span>
                                <button
                                  onClick={() => handleManagerAction(l.id, l.managerStatus === 'Approved' || l.status === 'APPROVED' ? 'REJECTED' : 'APPROVED')}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold underline ml-1 cursor-pointer"
                                >
                                  Change
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Feed View */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Loading team leave requests...
                </div>
              ) : displayedLeaves.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800 p-6">
                  No team leave applications found for {filterMode === 'MY_TEAM' ? 'your direct team' : 'this selection'}.
                </div>
              ) : (
                displayedLeaves.map(l => {
                  const emp = employees.find(
                    e => e.id === l.employeeId || e.employeeId === l.employeeId || e.name === l.employeeId
                  );
                  const isPending = l.managerStatus !== 'Approved' && l.managerStatus !== 'Rejected' && l.status !== 'APPROVED' && l.status !== 'REJECTED';

                  return (
                    <div key={l.id} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            #{l.id.replace(/[^0-9]/g, '').slice(-3) || l.id.slice(-3)}
                          </span>
                          <span className="font-bold text-xs text-white">{emp ? emp.name : l.employeeId}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {emp?.employeeId || l.employeeId}</span>
                      </div>

                      <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-purple-300 block">{l.leaveType}</span>
                          <span className="font-mono text-slate-300 text-[11px]">
                            {l.startDate === l.endDate || !l.endDate ? l.startDate : `${l.startDate} to ${l.endDate}`}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                          {l.daysCount || 1} {l.daysCount === 1 ? 'day' : 'days'}
                        </span>
                      </div>

                      {l.note && (
                        <div className="text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/50">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Reason:</span>
                          <p className="line-clamp-2 leading-relaxed">{l.note}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs py-1">
                        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                          <span className="text-[10px] text-slate-400 block font-semibold">Your Status:</span>
                          <span className="font-bold text-white text-[11px]">{l.managerStatus || (l.status === 'APPROVED' ? 'Approved' : 'Pending')}</span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                          <span className="text-[10px] text-slate-400 block font-semibold">HR Status:</span>
                          <span className="font-bold text-white text-[11px]">{getAdminStatusText(l)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        {isPending ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleManagerAction(l.id, 'APPROVED')}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center space-x-1 min-h-[44px] cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleManagerAction(l.id, 'REJECTED')}
                              className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1 min-h-[44px] border border-red-500/30 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              l.managerStatus === 'Approved' || l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
                            }`}>
                              {l.managerStatus === 'Approved' || l.status === 'APPROVED' ? '✓ Manager Approved' : '✗ Manager Rejected'}
                            </span>
                            <button
                              onClick={() => handleManagerAction(l.id, l.managerStatus === 'Approved' || l.status === 'APPROVED' ? 'REJECTED' : 'APPROVED')}
                              className="text-xs text-blue-400 hover:text-blue-300 font-bold underline py-2 px-2 cursor-pointer"
                            >
                              Change Decision
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
