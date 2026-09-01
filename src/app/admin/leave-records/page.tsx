'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import RecordLeaveModal from '@/components/RecordLeaveModal';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  AlertTriangle,
  Printer,
  HelpCircle,
  User,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { LeaveRecord, Employee, mergeLeavesNonRegressive, getLeaveTimestamp } from '@/lib/types';

export default function LeaveRecordsAdminPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Messages
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [actionStatusMsg, setActionStatusMsg] = useState('');

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
      console.error('Error fetching leave requests data:', err);
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

  const handleUpdateStatus = async (id: string, newStatus: 'APPROVED' | 'REJECTED' | 'MORE_INFO_REQUIRED') => {
    let comment = '';
    if (newStatus === 'MORE_INFO_REQUIRED') {
      const input = prompt('Please enter the detail request message for the employee:');
      if (!input) return;
      comment = input;
    }

    const newHrStatus = newStatus === 'APPROVED' ? 'Approved' : newStatus === 'REJECTED' ? 'Rejected' : 'More Info Requested';
    const targetRecord = leaves.find(
      l => l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))
    );

    const updatedTargetRecord = targetRecord
      ? {
          ...targetRecord,
          hrStatus: newHrStatus,
          managerStatus: newStatus === 'APPROVED' ? 'Approved' : targetRecord.managerStatus,
          status: newStatus,
        }
      : undefined;

    // Instant Optimistic UI Update (0ms table shift)
    setLeaves((prev) =>
      prev.map((l) => {
        if (l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))) {
          return {
            ...l,
            hrStatus: newHrStatus,
            managerStatus: newStatus === 'APPROVED' ? 'Approved' : l.managerStatus,
            status: newStatus,
          };
        }
        return l;
      }) as any
    );

    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('hrm_user_submitted_leaves') || '[]');
        if (Array.isArray(local) && local.length > 0) {
          const updatedLocal = local.map((l: any) => {
            if (l.id === id || (typeof l.id === 'string' && l.id.endsWith(id.replace(/[^0-9]/g, '')))) {
              return { ...l, hrStatus: newHrStatus, managerStatus: newStatus === 'APPROVED' ? 'Approved' : l.managerStatus, status: newStatus };
            }
            return l;
          });
          localStorage.setItem('hrm_user_submitted_leaves', JSON.stringify(updatedLocal));
        }
      } catch (e) {}
    }

    try {
      setActionStatusMsg('Updating leave request status...');
      const res = await fetch('/api/leaves', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          record: updatedTargetRecord,
          status: newStatus,
          approverRole: 'HR Final Approver',
          comment,
        }),
      });

      if (res.ok) {
        setActionStatusMsg(`Leave request #${id.slice(-4)} updated successfully!`);
        fetchLeavesAndEmployees();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('leaveDataUpdated'));
        }
      } else {
        const errData = await res.json();
        setActionStatusMsg(`Failed: ${errData.error || 'Could not update status'}`);
        fetchLeavesAndEmployees();
      }
      setTimeout(() => setActionStatusMsg(''), 4000);
    } catch (err) {
      console.error('Error updating leave status:', err);
      setActionStatusMsg('Failed to update leave request status.');
      fetchLeavesAndEmployees();
    }
  };

  // Helper formatting functions matching workflow
  const getManagerStatusLabel = (l: LeaveRecord, emp?: Employee) => {
    if (l.managerStatus === 'Approved' || l.status === 'APPROVED') return 'Approved ✓';
    if (l.managerStatus === 'Rejected') return 'Rejected ✗';
    return 'Pending';
  };

  const getAdminStatusLabel = (l: LeaveRecord) => {
    if (l.hrStatus === 'Approved' || l.status === 'APPROVED') return 'Approved ✓';
    if (l.hrStatus === 'Rejected' || l.status === 'REJECTED') return 'Rejected ✗';
    if (l.status === 'MORE_INFO_REQUIRED') return 'More Info Requested';
    return 'Pending HR';
  };

  const getFinalStatusBadge = (l: LeaveRecord) => {
    const isBothApproved = (l.managerStatus === 'Approved' || l.status === 'APPROVED') && (l.hrStatus === 'Approved' || l.status === 'APPROVED');
    if (isBothApproved || l.status === 'APPROVED') {
      return (
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold text-[10px] uppercase tracking-wider block text-center shadow-sm">
          HR AND MANAGER HAVE APPROVED ✓
        </span>
      );
    }
    if (l.status === 'REJECTED' || l.hrStatus === 'Rejected' || l.managerStatus === 'Rejected') {
      return (
        <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-extrabold text-[10px] uppercase tracking-wider block text-center shadow-sm">
          REJECTED ✗
        </span>
      );
    }
    if (l.status === 'MORE_INFO_REQUIRED') {
      return (
        <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-extrabold text-[10px] uppercase tracking-wider block text-center shadow-sm">
          MORE INFO REQUIRED
        </span>
      );
    }
    if (l.managerStatus === 'Approved') {
      return (
        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-extrabold text-[10px] uppercase tracking-wider block text-center shadow-sm">
          APPROVED BY MANAGER (PENDING HR)
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold text-[10px] uppercase tracking-wider block text-center shadow-sm">
        PENDING MANAGER APPROVAL
      </span>
    );
  };

  const handleClearLeaveHistory = async () => {
    if (!confirm('Are you sure you want to clear all leave histories? This action cannot be undone.')) {
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hrm_user_submitted_leaves');
        localStorage.removeItem('hrm_leave_records_backup');
        localStorage.removeItem('hrm_leave_quarter_overrides');
      }
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' }),
      });
      if (res.ok) {
        setLeaves([]);
        setActionStatusMsg('Leave history has been cleared successfully across all portals.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('leaveDataUpdated'));
        }
      } else {
        setActionStatusMsg('Failed to clear leave history.');
      }
    } catch (e) {
      console.error(e);
      setActionStatusMsg('Error clearing leave history.');
    } finally {
      setLoading(false);
    }
  };

  // Extract Departments for Filter
  const departmentsList = Array.from(new Set(employees.map(e => e.department).filter(Boolean)));

  // Filter Leaves
  // Pending Leave Requests requiring action (Table 1: Only non-finalized requests)
  const pendingApprovals = leaves.filter(
    l => l.status !== 'APPROVED' && l.status !== 'REJECTED' && l.managerStatus !== 'Rejected' && l.hrStatus !== 'Rejected'
  ).sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));

  // Historical Leaves Register (Table 2: Only finalized requests - Approved or Rejected)
  const historicalLeaves = leaves.filter(
    l => l.status === 'APPROVED' || l.status === 'REJECTED' || l.managerStatus === 'Rejected' || l.hrStatus === 'Rejected'
  );

  // Filter Historical Leaves
  const filteredLeaves = historicalLeaves.filter(l => {
    const emp = employees.find(
      e => e.id === l.employeeId ||
           e.employeeId === l.employeeId ||
           e.name.toLowerCase().trim() === (l.employeeId || '').toLowerCase().trim() ||
           (l.employeeId && e.id.toLowerCase() === l.employeeId.toLowerCase())
    );
    const empName = emp ? emp.name.toLowerCase() : '';
    const empId = emp ? emp.employeeId.toLowerCase() : '';
    const note = (l.note || '').toLowerCase();
    const searchLower = search.toLowerCase();

    const matchesSearch =
      !search ||
      empName.includes(searchLower) ||
      empId.includes(searchLower) ||
      l.leaveType.toLowerCase().includes(searchLower) ||
      note.includes(searchLower);

    const matchesDept = departmentFilter === 'ALL' || (emp && emp.department === departmentFilter);

    let matchesStatus = true;
    if (statusFilter === 'APPROVED') matchesStatus = l.status === 'APPROVED';
    else if (statusFilter === 'REJECTED') matchesStatus = l.status === 'REJECTED';
    else if (statusFilter === 'PENDING') matchesStatus = l.status === 'PENDING';
    else if (statusFilter === 'MORE_INFO') matchesStatus = l.status === 'MORE_INFO_REQUIRED';

    return matchesSearch && matchesDept && matchesStatus;
  }).sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="leave-records" />
        <main className="flex-1 p-4 md:p-8 w-full space-y-6 overflow-y-auto overflow-x-hidden">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-white font-heading flex items-center space-x-3">
                <FileCheck className="w-7 h-7 text-rose-400" />
                <span>Leave Requests & SLA Approvals Desk</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Monitor manager review responses, subordinate leave applications, and issue final HR decisions.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleClearLeaveHistory}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-slate-700/80 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 font-bold text-xs shadow-md transition flex items-center space-x-1.5"
                title="Clear all leave records from history"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Clear Leave History</span>
              </button>

              <button
                onClick={() => setIsRecordModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 flex items-center space-x-2 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Leave Request</span>
              </button>
            </div>
          </div>

          {/* Action Status Notification Toast */}
          {actionStatusMsg && (
            <div className="p-3 bg-blue-950/60 border border-blue-500/40 rounded-xl text-xs text-blue-200 font-medium flex items-center justify-between animate-fadeIn">
              <span>{actionStatusMsg}</span>
              <button onClick={() => setActionStatusMsg('')} className="text-blue-400 hover:text-white font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* 1. System Pending Leave Approvals & Manager SLA Section */}
          {pendingApprovals.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>System Pending Leave Approvals ({pendingApprovals.length} Pending)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Require final HR decision to add to Leave Tracker
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Leave Dates</th>
                      <th className="py-3 px-4 text-center">Duration</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Manager Status</th>
                      <th className="py-3 px-4 text-center">Admin Status</th>
                      <th className="py-3 px-4 text-center">Final Status</th>
                      <th className="py-3 px-4 text-right">HR Final Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pendingApprovals.map(l => {
                      const emp = employees.find(
                        e => e.id === l.employeeId || e.employeeId === l.employeeId || e.name === l.employeeId
                      );

                      const isSingle = !l.endDate || l.endDate === l.startDate;
                      const countNum = l.daysCount || (isSingle ? 1 : 2);

                      return (
                        <tr key={l.id} className="hover:bg-slate-850 transition">
                          {/* Employee */}
                          <td className="py-3 px-4">
                            <strong className="text-white block font-bold">{emp ? emp.name : l.employeeId}</strong>
                            <span className="text-[10px] text-slate-400">ID: {emp?.employeeId || l.employeeId}</span>
                          </td>

                          {/* Leave Dates */}
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {isSingle ? (
                              <span className="text-white font-bold">{l.startDate}</span>
                            ) : (
                              <div>
                                <div>{l.startDate}</div>
                                <div className="text-[10px] text-slate-400">to {l.endDate}</div>
                              </div>
                            )}
                          </td>

                          {/* Duration Badge */}
                          <td className="py-3 px-4 text-center">
                            {isSingle ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold text-[11px] inline-block">
                                {countNum === 0.5 ? '0.5 Day (Half)' : '1 Day'}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-extrabold text-[11px] inline-block">
                                {countNum} Days
                              </span>
                            )}
                          </td>

                          {/* Subject */}
                          <td className="py-3 px-4 font-bold text-rose-300">
                            {l.leaveType}
                          </td>

                          {/* Manager Status */}
                          <td className="py-3 px-4 text-center font-semibold text-slate-300">
                            {getManagerStatusLabel(l, emp)}
                          </td>

                          {/* Admin Status */}
                          <td className="py-3 px-4 text-center font-semibold text-slate-300">
                            {getAdminStatusLabel(l)}
                          </td>

                          {/* Final Status */}
                          <td className="py-3 px-4 text-center">
                            {getFinalStatusBadge(l)}
                          </td>

                          {/* HR Final Action */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => handleUpdateStatus(l.id, 'APPROVED')}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition flex items-center space-x-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve (HR Final)</span>
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(l.id, 'REJECTED')}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shadow transition flex items-center space-x-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Main Leave Requests Table (1:1 Screenshot Layout) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Table Controls Header */}
            <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50">
              <div>
                <h3 className="text-base font-bold text-white">Historical Leave Requests Register</h3>
                <p className="text-xs text-slate-400">
                  Searchable, audit-tracked leave requests register ({filteredLeaves.length} records shown)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, ID or subject..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 transition w-48 md:w-60"
                  />
                </div>

                {/* Department Filter */}
                <select
                  value={departmentFilter}
                  onChange={e => setDepartmentFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition"
                >
                  <option value="ALL">All Departments</option>
                  {departmentsList.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500 transition"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="PENDING">Pending</option>
                  <option value="MORE_INFO">More Info Required</option>
                </select>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Roster</span>
                </button>
              </div>
            </div>

            {/* Table Content - Matches 1:1 Screenshot Columns */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Request ID</th>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-4">Leave Dates</th>
                    <th className="py-3.5 px-4 text-center">Duration</th>
                    <th className="py-3.5 px-4">Subject</th>
                    <th className="py-3.5 px-4 text-center">Manager Status</th>
                    <th className="py-3.5 px-4 text-center">Admin Status</th>
                    <th className="py-3.5 px-4 text-center">Final Status</th>
                    <th className="py-3.5 px-4 text-center">Attachment</th>
                    <th className="py-3.5 px-4 text-center">Submitted Date</th>
                    <th className="py-3.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-500">
                        Loading leave requests...
                      </td>
                    </tr>
                  ) : filteredLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-500">
                        No leave records found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaves.map(l => {
                      const emp = employees.find(
                        e => e.id === l.employeeId || e.employeeId === l.employeeId || e.name === l.employeeId
                      );

                      const isSingle = !l.endDate || l.endDate === l.startDate;
                      const countNum = l.daysCount || (isSingle ? 1 : 2);

                      return (
                        <tr key={l.id} className="hover:bg-slate-850 transition">
                          {/* Request ID */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                            #{l.id.replace(/[^0-9]/g, '').slice(-3) || l.id.slice(-3)}
                          </td>

                          {/* Employee */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white">{emp ? emp.name : l.employeeId}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {emp?.employeeId || l.employeeId}
                            </div>
                          </td>

                          {/* Leave Dates */}
                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {isSingle ? (
                              <span className="text-white font-bold">{l.startDate}</span>
                            ) : (
                              <div>
                                <div>{l.startDate}</div>
                                <div className="text-[10px] text-slate-400">to {l.endDate}</div>
                              </div>
                            )}
                          </td>

                          {/* Duration Badge */}
                          <td className="py-3.5 px-4 text-center">
                            {isSingle ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold text-[11px] inline-block">
                                {countNum === 0.5 ? '0.5 Day (Half)' : '1 Day'}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-extrabold text-[11px] inline-block">
                                {countNum} Days
                              </span>
                            )}
                          </td>

                          {/* Subject */}
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {l.leaveType}
                          </td>

                          {/* Manager Status */}
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                            {getManagerStatusLabel(l, emp)}
                          </td>

                          {/* Admin Status */}
                          <td className="py-3.5 px-4 text-center font-semibold text-slate-300">
                            {getAdminStatusLabel(l)}
                          </td>

                          {/* Final Status */}
                          <td className="py-3.5 px-4 text-center">
                            {getFinalStatusBadge(l)}
                          </td>

                          {/* Attachment */}
                          <td className="py-3.5 px-4 text-center text-slate-500">
                            -
                          </td>

                          {/* Submitted Date */}
                          <td className="py-3.5 px-4 text-center text-[11px] font-mono text-slate-400">
                            {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '29 Jul 2026'}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-center">
                            {l.status === 'APPROVED' || l.hrStatus === 'Approved' ? (
                              <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-extrabold text-[10px] uppercase tracking-wider inline-block">
                                HR AND MANAGER HAVE APPROVED ✓
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-extrabold text-[10px] uppercase tracking-wider inline-block">
                                REJECTED ✗
                              </span>
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

      {/* Submit Leave Application Modal */}
      <RecordLeaveModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        employees={employees}
        onSuccess={() => {
          setActionStatusMsg('New leave request submitted successfully!');
          fetchLeavesAndEmployees();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('leaveDataUpdated'));
          }
        }}
      />
    </div>
  );
}
