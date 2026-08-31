'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import { LeaveRecord, Employee, mergeLeavesNonRegressive, getLeaveTimestamp } from '@/lib/types';

export default function HRTeamApprovalsPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const fetchLeavesAndEmployees = useCallback(async (isSilent = false) => {
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
      console.error('Error fetching HR Team Approvals data:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeavesAndEmployees(false);

    const handleUpdate = () => fetchLeavesAndEmployees(true);
    window.addEventListener('leaveDataUpdated', handleUpdate);

    const interval = setInterval(() => {
      fetchLeavesAndEmployees(true);
    }, 3000);

    return () => {
      window.removeEventListener('leaveDataUpdated', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchLeavesAndEmployees]);

  // HR Review Action with 0ms Instant Optimistic UI Update
  const handleHRReview = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    const newHrStatus = action === 'APPROVED' ? 'Approved' : 'Rejected';
    const newStatus = action === 'REJECTED' ? 'REJECTED' : 'APPROVED';

    const targetRecord = leaves.find(
      (l) => l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))
    );

    const updatedTargetRecord = targetRecord
      ? {
          ...targetRecord,
          hrStatus: newHrStatus,
          managerStatus: targetRecord.managerStatus === 'Approved' ? 'Approved' : newHrStatus,
          status: newStatus,
        }
      : undefined;

    // 1. Instant Optimistic State Update (0ms UI latency)
    setLeaves((prev) =>
      prev.map((l) => {
        if (l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))) {
          return {
            ...l,
            hrStatus: newHrStatus,
            managerStatus: l.managerStatus === 'Approved' ? 'Approved' : newHrStatus,
            status: newStatus,
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
              return { ...l, hrStatus: newHrStatus, managerStatus: 'Approved', status: newStatus };
            }
            return l;
          });
          localStorage.setItem('hrm_user_submitted_leaves', JSON.stringify(updatedLocal));
        }
      } catch (e) {}
    }

    setStatusMsg(`HR Decision Recorded: ${action}! Request status updated.`);

    try {
      const res = await fetch('/api/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          record: updatedTargetRecord,
          status: action,
          approverRole: 'HR Final Approver',
        }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('leaveDataUpdated'));
        }
      } else {
        const data = await res.json();
        setStatusMsg(`Failed: ${data.error || 'Could not update status'}`);
        fetchLeavesAndEmployees(true);
      }
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setStatusMsg('Failed to process HR decision.');
      fetchLeavesAndEmployees(true);
    }
  };

  // Filter leaves
  const filteredLeaves = leaves.filter((l) => {
    const emp = employees.find(
      (e) => e.id === l.employeeId || e.employeeId === l.employeeId || e.name.toLowerCase() === (l.employeeId || '').toLowerCase()
    );
    const empName = emp ? emp.name.toLowerCase() : (l.employeeId || '').toLowerCase();
    const matchesSearch = empName.includes(search.toLowerCase()) || (l.leaveType || '').toLowerCase().includes(search.toLowerCase()) || (l.note || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === 'PENDING') return l.hrStatus === 'Pending' || (!l.hrStatus && l.status === 'PENDING');
    if (filterStatus === 'APPROVED') return l.hrStatus === 'Approved' || l.status === 'APPROVED';
    if (filterStatus === 'REJECTED') return l.hrStatus === 'Rejected' || l.status === 'REJECTED';
    return true;
  }).sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));

  const pendingCount = leaves.filter((l) => l.hrStatus === 'Pending' || (!l.hrStatus && l.status === 'PENDING')).length;
  const approvedCount = leaves.filter((l) => l.hrStatus === 'Approved' || l.status === 'APPROVED').length;
  const rejectedCount = leaves.filter((l) => l.hrStatus === 'Rejected' || l.status === 'REJECTED').length;

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="team-approvals" role="ADMIN" />
        <main className="flex-1 p-4 md:p-8 w-full space-y-6 overflow-y-auto overflow-x-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black text-white font-heading flex items-center space-x-2.5">
                <ClipboardCheck className="w-7 h-7 text-blue-500" />
                <span>HR Team Approvals Desk</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Executive HR Approval & Override Desk for <strong className="text-purple-300">Ravina Khimani (HR / COO)</strong> • Full Company Leave Review
              </p>
            </div>
            <div className="flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-xl text-xs text-blue-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Full Admin HR Privileges Active</span>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-xs text-indigo-200 font-medium flex items-center justify-between shadow-lg animate-fade-in">
              <span>{statusMsg}</span>
              <button onClick={() => setStatusMsg('')} className="text-indigo-400 font-bold ml-2">✕</button>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl space-y-1">
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Leave Requests</p>
              <p className="text-2xl font-black text-white font-heading">{leaves.length}</p>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-amber-500/30 shadow-xl space-y-1">
              <p className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">Pending HR Approval</p>
              <p className="text-2xl font-black text-amber-300 font-heading">{pendingCount}</p>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-emerald-500/30 shadow-xl space-y-1">
              <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">HR Approved</p>
              <p className="text-2xl font-black text-emerald-300 font-heading">{approvedCount}</p>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-red-500/30 shadow-xl space-y-1">
              <p className="text-[11px] text-red-400 font-bold uppercase tracking-wider">Rejected Requests</p>
              <p className="text-2xl font-black text-red-300 font-heading">{rejectedCount}</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search employee, leave type, or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    filterStatus === st
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {st === 'ALL' ? 'All Applications' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <th className="py-3.5 px-4">Request ID</th>
                    <th className="py-3.5 px-4">Employee Details</th>
                    <th className="py-3.5 px-4">Dates & Leave Type</th>
                    <th className="py-3.5 px-4">Reason / Notes</th>
                    <th className="py-3.5 px-4 text-center">Manager Status</th>
                    <th className="py-3.5 px-4 text-center">HR Final Status</th>
                    <th className="py-3.5 px-4 text-right">HR Action Desk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Loading leave requests...
                      </td>
                    </tr>
                  ) : filteredLeaves.length > 0 ? (
                    filteredLeaves.map((l, index) => {
                      const emp = employees.find(
                        (e) => e.id === l.employeeId || e.employeeId === l.employeeId || e.name.toLowerCase() === (l.employeeId || '').toLowerCase()
                      );
                      const reqId = l.id && typeof l.id === 'string' ? `#${l.id.replace(/[^0-9]/g, '').slice(-3) || l.id.slice(-3)}` : `#${index + 1}`;
                      const isReviewed = l.hrStatus === 'Approved' || l.hrStatus === 'Rejected' || l.status === 'APPROVED' || l.status === 'REJECTED';

                      return (
                        <tr key={l.id || index} className="hover:bg-slate-850 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                            {reqId}
                          </td>
                          <td className="py-3.5 px-4">
                            <strong className="text-white block font-bold">{emp ? emp.name : l.employeeId}</strong>
                            <span className="text-[10px] text-slate-400">{emp?.department || 'Employee'} • ID: {emp?.employeeId || l.employeeId}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-purple-300 block">{l.leaveType}</span>
                            <span className="font-mono text-slate-300 text-[11px]">{l.startDate} to {l.endDate || l.startDate} ({l.daysCount} day{l.daysCount !== 1 ? 's' : ''})</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                            {l.note || 'Leave application'}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                              l.managerStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {l.managerStatus || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${
                              l.hrStatus === 'Approved' || l.status === 'APPROVED'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : l.hrStatus === 'Rejected' || l.status === 'REJECTED'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}>
                              {l.hrStatus === 'Approved' || l.status === 'APPROVED' ? 'Approved ✓' : l.hrStatus === 'Rejected' || l.status === 'REJECTED' ? 'Rejected ✗' : 'Pending HR'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {!isReviewed ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleHRReview(l.id, 'APPROVED')}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow flex items-center space-x-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve (HR Final)</span>
                                </button>
                                <button
                                  onClick={() => handleHRReview(l.id, 'REJECTED')}
                                  className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-lg transition flex items-center space-x-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end space-x-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                  l.hrStatus === 'Approved' || l.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'
                                }`}>
                                  {l.hrStatus === 'Approved' || l.status === 'APPROVED' ? '✓ HR Approved' : '✗ HR Rejected'}
                                </span>
                                <button
                                  onClick={() => handleHRReview(l.id, l.hrStatus === 'Approved' || l.status === 'APPROVED' ? 'REJECTED' : 'APPROVED')}
                                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold underline ml-1"
                                >
                                  Change
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No leave applications match the selected filter.
                      </td>
                    </tr>
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
