'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  MapPin,
  Clock,
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
  ExternalLink,
  Shield,
  Layers,
  Globe,
  Mail,
  Phone,
} from 'lucide-react';
import { Company, DEFAULT_COMPANIES } from '@/lib/types';

export default function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [search, setSearch] = useState('');

  // Active Company Selection
  const [activeCompanyId, setActiveCompanyId] = useState<string>('company-main');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    slug: '',
    logoUrl: '',
    contactEmail: '',
    contactPhone: '',
    shiftStartTime: '09:00',
    lunchBreakMinutes: 60,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalCompany, setDeleteModalCompany] = useState<Company | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hrm_selected_company_id');
      if (stored) setActiveCompanyId(stored);
    }
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/companies?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCompanies(data);
      } else {
        setCompanies(DEFAULT_COMPANIES);
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load companies.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCompany(null);
    setFormData({
      name: '',
      code: '',
      slug: '',
      logoUrl: '',
      contactEmail: '',
      contactPhone: '',
      shiftStartTime: '09:00',
      lunchBreakMinutes: 60,
      dailyWorkingRequirementMinutes: 480,
      weeklyOff: 'Sunday',
      status: 'ACTIVE',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setFormData({
      name: comp.name,
      code: comp.code,
      slug: comp.slug,
      logoUrl: comp.logoUrl || '',
      contactEmail: comp.contactEmail || '',
      contactPhone: comp.contactPhone || '',
      shiftStartTime: comp.shiftStartTime || '09:00',
      lunchBreakMinutes: comp.lunchBreakMinutes || 60,
      dailyWorkingRequirementMinutes: comp.dailyWorkingRequirementMinutes || 480,
      weeklyOff: comp.weeklyOff || 'Sunday',
      status: comp.status || 'ACTIVE',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const isEdit = Boolean(editingCompany);
      const url = '/api/companies';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = isEdit
        ? {
            id: editingCompany!.id,
            ...formData,
          }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save company.');
      }

      setFlash(isEdit ? `Company "${formData.name}" updated successfully!` : `New company workspace "${formData.name}" initialized!`);
      setTimeout(() => setFlash(''), 4500);
      setModalOpen(false);
      await fetchCompanies();
    } catch (err: any) {
      setError(err.message || 'Error saving company.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalCompany) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/companies?id=${deleteModalCompany.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete company.');
      }
      setFlash(`Company "${deleteModalCompany.name}" deleted successfully.`);
      setTimeout(() => setFlash(''), 4500);
      setDeleteModalCompany(null);
      await fetchCompanies();
    } catch (err: any) {
      setError(err.message || 'Error deleting company.');
      setDeleteModalCompany(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchSpace = (comp: Company) => {
    setActiveCompanyId(comp.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrm_selected_company_id', comp.id);
      localStorage.setItem('hrm_selected_company_name', comp.name);
      document.cookie = `hrm_user_company=${comp.id}; path=/; max-age=86400 * 30`;
      window.dispatchEvent(new CustomEvent('companyChange', { detail: comp }));
    }
    setFlash(`Switched active space to: ${comp.name}!`);
    setTimeout(() => setFlash(''), 3000);
  };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  const totalEmployees = companies.reduce((acc, c) => acc + (c.employeeCount || 0), 0);
  const activeCount = companies.filter(c => c.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              <span>Multi-Tenant Architecture</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400">Zero-Disruption Isolation</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center space-x-2.5">
            <Building2 className="w-7 h-7 text-indigo-400" />
            <span>Companies Management Desk</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Create and manage corporate company spaces, brand logos, shift policies, and tenant allocations.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchCompanies()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="Refresh Companies"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 transition flex items-center space-x-2 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Company</span>
          </button>
        </div>
      </div>

      {/* Flash Notice */}
      {flash && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium">{flash}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Companies</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{companies.length}</span>
            <span className="text-xs text-slate-500">Corporate Tenants</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Workspaces</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-emerald-400">{activeCount}</span>
            <span className="text-xs text-slate-500">Operational</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Global Staff</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-blue-400">{totalEmployees}</span>
            <span className="text-xs text-slate-500">Across all companies</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Primary Company</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-extrabold text-purple-300 text-lg truncate">
              {companies.find(c => c.isDefault)?.name || 'Digital Suncity'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Default Corporate Tenant</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search company by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div className="text-xs text-slate-400 self-end sm:self-center font-medium">
          Showing <span className="text-white font-bold">{filtered.length}</span> of {companies.length} companies
        </div>
      </div>

      {/* Company Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(comp => {
          const isSelected = activeCompanyId === comp.id;
          return (
            <div
              key={comp.id}
              className={`rounded-2xl border transition-all duration-200 bg-slate-900/90 flex flex-col justify-between overflow-hidden relative shadow-lg ${
                isSelected
                  ? 'border-indigo-500 shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {comp.isDefault && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-600 to-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider shadow">
                  HQ Primary
                </div>
              )}

              <div className="p-6 space-y-4">
                {/* Header with Logo/Initials and Titles */}
                <div className="flex items-start space-x-3.5">
                  {comp.logoUrl ? (
                    <img
                      src={comp.logoUrl}
                      alt={comp.name}
                      className="w-12 h-12 rounded-xl object-contain bg-slate-800 border border-slate-700 p-1 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md">
                      {comp.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 pr-16">
                    <h3 className="font-extrabold text-base text-white tracking-tight truncate flex items-center gap-1.5">
                      <span>{comp.name}</span>
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {comp.code}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          comp.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {comp.status || 'ACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Company Details Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-slate-800/80">
                  <div className="flex items-center space-x-2 text-slate-300 bg-slate-800/40 p-2 rounded-xl">
                    <Users className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Staff Count</div>
                      <span className="font-black text-white text-sm">{comp.employeeCount || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-slate-300 bg-slate-800/40 p-2 rounded-xl">
                    <MapPin className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">Branches</div>
                      <span className="font-black text-white text-sm">{comp.branchesCount || 1}</span>
                    </div>
                  </div>
                </div>

                {/* Shift Details */}
                <div className="space-y-1.5 bg-slate-800/30 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Shift Start:</span>
                    </span>
                    <span className="font-bold text-white font-mono">{comp.shiftStartTime || '09:00'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>Working Target:</span>
                    </span>
                    <span className="font-bold text-white">
                      {comp.dailyWorkingRequirementMinutes === 420 ? '8h Shift (7h work + 1h break)' : '9h Shift (8h work + 1h break)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Weekly Off:</span>
                    <span className="font-bold text-indigo-300">{comp.weeklyOff || 'Sunday'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleSwitchSpace(comp)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 cursor-default'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 active:scale-95'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isSelected ? 'Active Space ✓' : 'Switch to Space'}</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(comp)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                    title="Edit Company Details"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteModalCompany(comp)}
                    disabled={comp.isDefault}
                    className={`p-2 rounded-xl border transition ${
                      comp.isDefault
                        ? 'opacity-30 cursor-not-allowed bg-slate-800/50 text-slate-500 border-slate-800'
                        : 'bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 border-slate-700 cursor-pointer'
                    }`}
                    title={comp.isDefault ? 'Primary HQ space cannot be deleted' : 'Delete Company'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Company Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">
                    {editingCompany ? `Edit Company: ${editingCompany.name}` : 'Create New Company Space'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editingCompany
                      ? 'Update workspace branding and shift policies'
                      : 'Initialize an isolated workspace with its own branches and staff roster'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">
                    Company Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        name: val,
                        code: prev.code || val.slice(0, 3).toUpperCase(),
                        slug: prev.slug || val.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                      }));
                    }}
                    placeholder="e.g. Acme Corporation"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">
                    Company Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ACME"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-300 mb-1.5">Company Logo URL</label>
                  <input
                    type="url"
                    value={formData.logoUrl}
                    onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Will appear dynamically in the top navigation header when inside this workspace.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Contact Email</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="admin@company.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Contact Phone</label>
                  <input
                    type="text"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+91 98765 00000"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Shift Start Time</label>
                  <input
                    type="time"
                    value={formData.shiftStartTime}
                    onChange={e => setFormData({ ...formData, shiftStartTime: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Daily Working Hours</label>
                  <select
                    value={formData.dailyWorkingRequirementMinutes}
                    onChange={e => setFormData({ ...formData, dailyWorkingRequirementMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={420}>8 Hours Shift (7h work + 1h break)</option>
                    <option value={480}>9 Hours Shift (8h work + 1h break)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Weekly Off Schedule</label>
                  <select
                    value={formData.weeklyOff}
                    onChange={e => setFormData({ ...formData, weeklyOff: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Sunday">Sunday (1 Day Off)</option>
                    <option value="Saturday & Sunday">Saturday & Sunday (2 Days Off)</option>
                    <option value="Friday & Saturday">Friday & Saturday (2 Days Off)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="SUSPENDED">SUSPENDED (Locked)</option>
                  </select>
                </div>
              </div>

              {/* Initial Admin Setup for New Companies */}
              {!editingCompany && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-indigo-400 font-bold">
                    <Shield className="w-4 h-4" />
                    <span>Create Company Administrator Account (Optional)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-slate-400 mb-1">Admin Name</label>
                      <input
                        type="text"
                        value={formData.adminName}
                        onChange={e => setFormData({ ...formData, adminName: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-400 mb-1">Admin Email</label>
                      <input
                        type="email"
                        value={formData.adminEmail}
                        onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                        placeholder="rahul@acme.com"
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-400 mb-1">Password</label>
                      <input
                        type="text"
                        value={formData.adminPassword}
                        onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                        placeholder="Default: Admin@123"
                        className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold transition shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingCompany ? 'Update Workspace' : 'Initialize Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white">Delete Company Workspace?</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">"{deleteModalCompany.name}"</strong>?
                This action is irreversible and requires zero active staff to be assigned to this workspace.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3">
              <button
                onClick={() => setDeleteModalCompany(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
