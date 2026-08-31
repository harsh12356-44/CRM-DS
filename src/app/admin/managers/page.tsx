'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import {
  UserCheck2,
  ShieldCheck,
  Mail,
  Building2,
  UserPlus,
  CheckCircle,
  Users,
  X,
  Plus,
  UserMinus,
  CheckCircle2,
} from 'lucide-react';
import { Employee, Department } from '@/lib/types';

export default function ManagersAdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Assign Subordinate Modal state
  const [assignModalMgr, setAssignModalMgr] = useState<Employee | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  // Designate New Manager Modal state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteEmpId, setPromoteEmpId] = useState<string>('');

  const loadManagersData = async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/departments'),
      ]);
      const empData = await empRes.json();
      const deptData = await deptRes.json();

      setEmployees(Array.isArray(empData) ? empData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagersData();
  }, []);

  // Filter managers: ONLY employees whose role is explicitly designated as MANAGER or ADMIN
  const managers = employees.filter(
    (e) => e.role === 'MANAGER' || e.role === 'ADMIN'
  );

  // Handle Assign Subordinate to Manager (Supports Dual Managers: Primary & Secondary)
  const handleAssignSubordinate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalMgr || !selectedSubId) return;

    try {
      const targetEmp = employees.find((emp) => emp.id === selectedSubId);
      if (!targetEmp) return;

      let updatePayload: Partial<Employee> = {};

      if (!targetEmp.primaryManager || targetEmp.primaryManager === '-- None --') {
        updatePayload.primaryManager = assignModalMgr.name;
      } else if (!targetEmp.secondaryManager || targetEmp.secondaryManager === '-- None --') {
        updatePayload.secondaryManager = assignModalMgr.name;
      } else {
        // If both managers are filled, replace secondary manager
        updatePayload.secondaryManager = assignModalMgr.name;
      }

      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetEmp.id,
          ...updatePayload,
        }),
      });

      setMessage(`Assigned ${targetEmp.name} as a subordinate under ${assignModalMgr.name}!`);
      setTimeout(() => setMessage(''), 4000);
      setAssignModalMgr(null);
      setSelectedSubId('');
      loadManagersData();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Remove Subordinate from Manager
  const handleRemoveSubordinate = async (sub: Employee, mgrName: string) => {
    try {
      let updatePayload: Partial<Employee> = {};
      if (sub.primaryManager === mgrName) {
        updatePayload.primaryManager = '';
      }
      if (sub.secondaryManager === mgrName) {
        updatePayload.secondaryManager = '';
      }

      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sub.id,
          ...updatePayload,
        }),
      });

      setMessage(`Removed ${sub.name} from ${mgrName}'s subordinate list.`);
      setTimeout(() => setMessage(''), 4000);
      loadManagersData();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Promoting Employee to Manager
  const handlePromoteToManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoteEmpId) return;

    try {
      const targetEmp = employees.find((emp) => emp.id === promoteEmpId);
      if (!targetEmp) return;

      await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetEmp.id,
          role: 'MANAGER',
        }),
      });

      setMessage(`Promoted ${targetEmp.name} to Designated Manager!`);
      setTimeout(() => setMessage(''), 4000);
      setShowPromoteModal(false);
      setPromoteEmpId('');
      loadManagersData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="managers" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-white font-heading flex items-center space-x-3">
                <UserCheck2 className="w-6 h-6 text-purple-400" />
                <span>Managers & Dual-Reporting Subordinates Desk</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Assign team subordinates under primary or secondary managers. Single employees can report to up to two managers simultaneously.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold">
                {managers.length} Designated Managers
              </span>
              <button
                onClick={() => setShowPromoteModal(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/30 transition flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Designate New Manager</span>
              </button>
            </div>
          </div>

          {message && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{message}</span>
            </div>
          )}

          {/* Manager Allocation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading manager roster...</div>
            ) : managers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-slate-400">No designated managers found. Promote employees to Manager role above.</div>
            ) : (
              managers.map((mgr) => {
                const managedDepts = departments.filter((d) => d.managerName === mgr.name);

                // Subordinates assigned directly to this manager as Primary (Manager 1) OR Secondary (Manager 2)
                const directSubordinates = employees.filter(
                  (e) => e.id !== mgr.id && (e.primaryManager === mgr.name || e.secondaryManager === mgr.name)
                );

                return (
                  <div
                    key={mgr.id}
                    className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition space-y-5 shadow-lg flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Manager Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                            {mgr.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-base font-heading">{mgr.name}</h3>
                            <p className="text-xs text-slate-400">{mgr.designation || 'Department Manager'}</p>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                              {mgr.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center space-x-1.5">
                            <Mail className="w-3.5 h-3.5 text-purple-400" />
                            <span>Email:</span>
                          </span>
                          <span className="text-slate-200 font-mono font-medium truncate max-w-[150px]">{mgr.email}</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Department:</span>
                          </span>
                          <span className="text-slate-200 font-semibold">{mgr.department}</span>
                        </div>

                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center space-x-1.5">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Head of Depts:</span>
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {managedDepts.length > 0 ? managedDepts.map((d) => d.name).join(', ') : 'General Oversight'}
                          </span>
                        </div>
                      </div>

                      {/* Subordinates Section */}
                      <div className="pt-3 border-t border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 font-heading">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Subordinates ({directSubordinates.length})</span>
                          </span>

                          <button
                            onClick={() => {
                              setAssignModalMgr(mgr);
                              setSelectedSubId('');
                            }}
                            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Assign Subordinate</span>
                          </button>
                        </div>

                        {directSubordinates.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {directSubordinates.map((sub) => {
                              const isPrimary = sub.primaryManager === mgr.name;
                              return (
                                <div
                                  key={sub.id}
                                  className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 flex items-center space-x-1.5 group"
                                >
                                  <span className="font-semibold">{sub.name}</span>
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                    isPrimary ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                                  }`}>
                                    {isPrimary ? 'Mgr 1' : 'Mgr 2'}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveSubordinate(sub, mgr.name)}
                                    title={`Remove ${sub.name} from ${mgr.name}`}
                                    className="text-slate-500 hover:text-red-400 transition"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 italic py-1">No direct subordinates assigned yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal 1: Assign Subordinate Modal */}
          {assignModalMgr && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white font-heading">
                    Assign Subordinate to {assignModalMgr.name}
                  </h3>
                  <button onClick={() => setAssignModalMgr(null)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAssignSubordinate} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Select Employee to Assign</label>
                    <select
                      required
                      value={selectedSubId}
                      onChange={(e) => setSelectedSubId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium"
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees
                        .filter((e) => e.id !== assignModalMgr.id)
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.department} • {emp.designation || emp.role})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAssignModalMgr(null)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedSubId}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 disabled:opacity-40"
                    >
                      Assign Subordinate
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal 2: Designate New Manager Modal */}
          {showPromoteModal && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white font-heading">Designate New Manager</h3>
                  <button onClick={() => setShowPromoteModal(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handlePromoteToManager} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1.5">Select Employee to Promote to Manager</label>
                    <select
                      required
                      value={promoteEmpId}
                      onChange={(e) => setPromoteEmpId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium"
                    >
                      <option value="">-- Choose Employee --</option>
                      {employees
                        .filter((e) => e.role !== 'MANAGER' && e.role !== 'ADMIN')
                        .map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} ({emp.department} • {emp.designation})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowPromoteModal(false)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!promoteEmpId}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-md shadow-purple-600/30 disabled:opacity-40"
                    >
                      Designate Manager
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
