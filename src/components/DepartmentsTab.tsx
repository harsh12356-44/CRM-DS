'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, Users, Shield, Search, X, Edit, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Employee } from '@/lib/types';

interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  description?: string;
  employeeCount: number;
}

export default function DepartmentsTab() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDept, setEditDept] = useState<DepartmentItem | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<DepartmentItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [managerName, setManagerName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/employees'),
      ]);
      const deptData = await deptRes.json();
      const empData = await empRes.json();
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditDept(null);
    setName('');
    setCode('');
    setManagerName(employees.find(e => e.role === 'MANAGER' || e.role === 'ADMIN')?.name || 'Harshit Bhootra');
    setDescription('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (dept: DepartmentItem) => {
    setEditDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setManagerName(dept.managerName || 'Harshit Bhootra');
    setDescription(dept.description || '');
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    try {
      if (editDept) {
        // Edit Department Structure matching user screenshot 1:1
        await fetch('/api/departments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editDept.id,
            name,
            code,
            managerName,
            description,
          }),
        });
        setMessage(`Updated department structure for ${name}!`);
      } else {
        // Add New Department
        await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, code, managerName, description }),
        });
        setMessage(`Created new department ${name}!`);
      }

      setTimeout(() => setMessage(''), 4000);
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;
    try {
      await fetch(`/api/departments?id=${deptToDelete.id}`, {
        method: 'DELETE',
      });
      setMessage(`Department ${deptToDelete.name} removed successfully.`);
      setTimeout(() => setMessage(''), 4000);
      setDeptToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDepts = departments.filter(
    d =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase())
  );

  // List of Managers for Department Head dropdown matching Screenshot 1:1
  const managers = employees.filter(e => e.role === 'MANAGER' || e.role === 'ADMIN' || e.designation?.toLowerCase().includes('manager'));

  return (
    <div className="space-y-6 text-slate-100 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 border border-indigo-800/60 rounded-3xl p-7 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>Organizational Architecture</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight font-heading">Departments Roster</h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Configure company departments, edit department structure, assign department heads, and remove obsolete departments.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="z-10 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Department</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-2xl">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search department by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading departments...</div>
        ) : filteredDepts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">No departments found</div>
        ) : (
          filteredDepts.map(d => (
            <div
              key={d.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-indigo-500/40 transition shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-extrabold text-xs font-mono">
                    {d.code}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleOpenEditModal(d)}
                      title="Edit Department Structure"
                      className="p-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeptToDelete(d)}
                      title="Remove Department"
                      className="p-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white font-heading">{d.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{d.description}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-semibold text-xs">Head: {d.managerName || 'Unassigned'}</span>
                </div>
                <div className="flex items-center space-x-1.5 text-slate-400 text-xs font-semibold">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{d.employeeCount} Members</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 1:1 Edit Department Structure Modal Matching User Screenshot */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 text-white space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base font-heading">
                {editDept ? `Edit Department Structure: ${editDept.name}` : 'Add New Department'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  Department Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Harshit Bhootra or Engineering"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">
                  Department Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. dev"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Department Head / Manager</label>
                <select
                  value={managerName}
                  onChange={e => setManagerName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Unassigned">-- Select Manager --</option>
                  {managers.map(mgr => (
                    <option key={mgr.id} value={mgr.name}>
                      {mgr.name} ({mgr.employeeId || '123456'} • {mgr.designation || mgr.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1.5">Description</label>
                <textarea
                  placeholder="Department purpose and scope..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Form Buttons at bottom right matching User Screenshot 1:1 */}
              <div className="pt-4 border-t border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold border border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Department Confirmation Modal */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-extrabold text-white font-heading">Remove Department</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove the department <strong className="text-white">{deptToDelete.name}</strong> ({deptToDelete.code})?
              <br /><br />
              <span className="text-red-400 font-semibold">Warning:</span> Removing this department will unassign all members associated with it.
            </p>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setDeptToDelete(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDepartment}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/30"
              >
                Remove Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
