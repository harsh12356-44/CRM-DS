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

      if (serverLeaves.length === 0) {
        setLeaves([]);
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('hrm_user_submitted_leaves');
            localStorage.removeItem('hrm_leave_records_backup');
          } catch (e) {}
        }
      } else {
        let localSaved: LeaveRecord[] = [];
        if (typeof window !== 'undefined') {
          try {
            localSaved = JSON.parse(localStorage.getItem('hrm_user_submitted_leaves') || '[]');
          } catch (e) {}
        }

        setLeaves((prev) => {
          const merged = mergeLeavesNonRegressive(mergeLeavesNonRegressive(prev, localSaved), serverLeaves);
          if (typeof window !== 'undefined' && merged.length > 0) {
            try {
              localStorage.setItem('hrm_user_submitted_leaves', JSON.stringify(merged));
            } catch (e) {}
          }
          return merged;
        });
      }

      setEmployees(Array.isArray(empData) ? empData : empData.employees || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

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

    const targetRecord = (leaves || []).find(l => l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, ''))));
    const updatedTargetRecord = targetRecord
      ? {
          ...targetRecord,
          managerStatus: newManagerStatus,
          status: (newManagerStatus === 'Approved' && targetRecord.hrStatus === 'Approved') ? 'APPROVED' : newStatus || targetRecord.status,
        }
      : undefined;

    setLeaves(prev =>
      prev.map(l => {
        if (l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))) {
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

    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('hrm_user_submitted_leaves') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          const updatedLocal = local.map((l: any) => {
            if (l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))) {
              return { ...l, managerStatus: newManagerStatus, status: (newManagerStatus === 'Approved' && l.hrStatus === 'Approved') ? 'APPROVED' : newStatus || l.status };
            }
            return l;
          });
          localStorage.setItem('hrm_user_submitted_leaves', JSON.stringify(updatedLocal));
        }
      } catch (e) {}
    }

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
                Review subordinate leave applications and monitor real-time HR final decisions.
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
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Subordinate Leave Requests Register</span>
            </h3>

            <div className="overflow-x-auto">
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
                  ) : leaves.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No team leave applications found.
                      </td>
                    </tr>
                  ) : (
                    leaves.map(l => {
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
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition shadow flex items-center space-x-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  onClick={() => handleManagerAction(l.id, 'REJECTED')}
                                  className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-[11px] font-bold rounded-lg transition flex items-center space-x-1"
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
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold underline ml-1"
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
          </div>
        </main>
      </div>
    </div>
  );
}
