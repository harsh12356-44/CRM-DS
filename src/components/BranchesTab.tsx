'use client';

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  Users,
  Clock,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { Branch, DEFAULT_BRANCHES } from '@/lib/types';

export default function BranchesTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [search, setSearch] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    dailyWorkingRequirementMinutes: 420,
    weeklyOff: 'Sunday',
    address: '',
    isDefault: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalBranch, setDeleteModalBranch] = useState<Branch | null>(null);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/branches?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setBranches(data);
      } else {
        setBranches(DEFAULT_BRANCHES);
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load branches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openAddModal = () => {
    setEditingBranch(null);
    setFormData({
      name: '',
      code: '',
      dailyWorkingRequirementMinutes: 420,
      weeklyOff: 'Sunday',
      address: '',
      isDefault: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (b: Branch) => {
    setEditingBranch(b);
    setFormData({
      name: b.name,
      code: b.code,
      dailyWorkingRequirementMinutes: b.dailyWorkingRequirementMinutes || 420,
      weeklyOff: b.weeklyOff || 'Sunday',
      address: b.address || '',
      isDefault: Boolean(b.isDefault),
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      const url = '/api/branches';
      const method = editingBranch ? 'PUT' : 'POST';
      const payload = editingBranch ? { id: editingBranch.id, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to save branch.');

      setFlash(editingBranch ? `Branch "${formData.name}" updated successfully.` : `Branch "${formData.name}" created successfully.`);
      setTimeout(() => setFlash(''), 3500);
      setModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalBranch) return;
    try {
      const res = await fetch(`/api/branches?id=${deleteModalBranch.id}`, { method: 'DELETE' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to delete branch.');

      setFlash(`Branch "${deleteModalBranch.name}" deleted.`);
      setTimeout(() => setFlash(''), 3000);
      setDeleteModalBranch(null);
      fetchBranches();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredBranches = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase()) ||
    (b.address && b.address.toLowerCase().includes(search.toLowerCase()))
  );

  const totalEmployees = branches.reduce((acc, b) => acc + (b.employeeCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-400 text-xs font-black uppercase tracking-wider mb-1">
            <MapPin className="w-4 h-4" />
            <span>Multi-Branch Architecture</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tight">Company Branches</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure locations, shifts, weekly offs, and employee allocation across Digital Suncity branches.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={fetchBranches}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Refresh branches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-purple-600/30 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Branch</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {flash && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{flash}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400">Total Branches</p>
            <p className="text-2xl font-black text-white font-heading mt-0.5">{branches.length}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Active physical & digital wings</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400">Total Assigned Headcount</p>
            <p className="text-2xl font-black text-white font-heading mt-0.5">{totalEmployees}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Across all branches</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400">Active Work Policies</p>
            <p className="text-2xl font-black text-emerald-400 font-heading mt-0.5">8h & 9h Shifts</p>
            <p className="text-[10px] text-slate-500 mt-0.5">1-Day & 2-Day weekly off schedules</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branch name, code, address..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <p className="text-xs text-slate-400 self-start sm:self-auto">
          Showing <strong className="text-white">{filteredBranches.length}</strong> branch(es)
        </p>
      </div>

      {/* Branches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredBranches.map((branch) => {
          const isMain = branch.id === 'branch-main' || branch.code === 'MAIN';
          const isNineHour = branch.dailyWorkingRequirementMinutes === 480;

          return (
            <div
              key={branch.id}
              className={`p-6 rounded-2xl bg-slate-900 border transition shadow-xl relative flex flex-col justify-between ${
                branch.isDefault
                  ? 'border-purple-500/40 shadow-purple-950/20 ring-1 ring-purple-500/20'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top card row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      isMain
                        ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-extrabold text-white truncate font-heading">{branch.name}</h3>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                          {branch.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{branch.address || 'Location unassigned'}</p>
                    </div>
                  </div>

                  {branch.isDefault && (
                    <span className="shrink-0 inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Primary HQ</span>
                    </span>
                  )}
                </div>

                {/* Branch Configuration Details */}
                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-800/80">
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Daily Shift Rule</span>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-xs font-extrabold text-slate-200">
                        {isNineHour ? '9h Shift (8h work + 1h break)' : '8h Shift (7h work + 1h break)'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weekly Off Schedule</span>
                    <div className="flex items-center space-x-1.5 mt-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-extrabold text-slate-200">
                        {branch.weeklyOff}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Headcount Banner */}
                <div className="mt-3 px-3.5 py-2.5 rounded-xl bg-slate-800/30 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center space-x-1.5 font-medium">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Allocated Staff:</span>
                  </span>
                  <span className="font-extrabold text-white font-mono">
                    {branch.employeeCount || 0} Employee(s)
                  </span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center justify-end space-x-2 pt-4 mt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => openEditModal(branch)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex items-center space-x-1.5 cursor-pointer transition"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit Branch</span>
                </button>
                {!branch.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDeleteModalBranch(branch)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold text-rose-300 flex items-center space-x-1.5 cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Branch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-black text-white font-heading">
                  {editingBranch ? 'Edit Branch' : 'Add New Branch'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. SEO Branch, Mumbai HQ, Tech Wing"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SEO, MAIN, DLH"
                    maxLength={8}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Daily Shift Target *</label>
                  <select
                    value={formData.dailyWorkingRequirementMinutes}
                    onChange={(e) => setFormData({ ...formData, dailyWorkingRequirementMinutes: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-purple-500 font-semibold cursor-pointer"
                  >
                    <option value={420}>8h Shift (7h Work + 1h Break)</option>
                    <option value={480}>9h Shift (8h Work + 1h Break)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Weekly Off Policy *</label>
                <select
                  value={formData.weeklyOff}
                  onChange={(e) => setFormData({ ...formData, weeklyOff: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-purple-500 font-semibold cursor-pointer"
                >
                  <option value="Sunday">Sunday Only (1 Day Off)</option>
                  <option value="Saturday & Sunday">Saturday & Sunday (2 Days Off)</option>
                  <option value="Friday & Saturday">Friday & Saturday (2 Days Off)</option>
                  <option value="Sunday & Monday">Sunday & Monday (2 Days Off)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Employees assigned to this branch automatically inherit this weekly off schedule.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Branch Address / Location</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 4th Floor, Tech Park, Jaipur"
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-semibold resize-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded text-purple-600 bg-slate-800 border-slate-700 cursor-pointer"
                />
                <label htmlFor="isDefault" className="text-slate-300 font-bold cursor-pointer">
                  Set as Company Primary HQ
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold flex items-center space-x-1.5 shadow-lg shadow-purple-600/30 cursor-pointer transition disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? 'Saving…' : editingBranch ? 'Update Branch' : 'Create Branch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">Delete Branch</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete branch <strong className="text-white">&ldquo;{deleteModalBranch.name}&rdquo;</strong>?
              {deleteModalBranch.employeeCount ? ` It currently has ${deleteModalBranch.employeeCount} assigned employee(s).` : ''}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalBranch(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs cursor-pointer shadow-lg shadow-rose-600/30"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
