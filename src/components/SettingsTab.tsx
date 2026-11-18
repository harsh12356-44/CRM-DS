'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Save,
  Clock,
  Building,
  Link2,
  CheckCircle2,
  AlertCircle,
  Upload,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Bell,
  UserCheck2,
  Shield,
  Check,
} from 'lucide-react';
import { CompanySettings } from '@/lib/types';

export default function SettingsTab() {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: 'HRM Pilot',
    companyLogoUrl: '',
    shiftStartTime: '09:00',
    lunchBreakMinutes: 60,
    halfDayThresholdMinutes: 240,
    loginUrl: '/login',
    employeePortalUrl: '/employee',
    managerPortalUrl: '/manager',
    notificationSettings: {
      enabled: true,
      notifyAdminOnLeaveApply: true,
      notifyManagerOnLeaveApply: true,
      notifyEmployeeLeaveBalance: true,
      notifyEmployeeOnStatusUpdate: true,
    },
  });

  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState('');
  const [logoError, setLogoError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/settings?_t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setSettings(data);
          if (data.companyLogoUrl) {
            try {
              localStorage.setItem('hrm_company_logo', data.companyLogoUrl);
            } catch {}
          }
          if (data.companyName) {
            try {
              localStorage.setItem('hrm_company_name', data.companyName);
            } catch {}
          }
        }
      })
      .catch(err => console.error(err));
  }, []);

  const notifySettingsUpdated = (newSettings: CompanySettings) => {
    try {
      if (newSettings.companyLogoUrl) {
        localStorage.setItem('hrm_company_logo', newSettings.companyLogoUrl);
      } else {
        localStorage.removeItem('hrm_company_logo');
      }
      if (newSettings.companyName) {
        localStorage.setItem('hrm_company_name', newSettings.companyName);
      }
      window.dispatchEvent(
        new CustomEvent('settingsUpdated', {
          detail: {
            companyLogoUrl: newSettings.companyLogoUrl,
            companyName: newSettings.companyName,
          },
        })
      );
    } catch {}
  };

  const handleProcessFile = async (file: File) => {
    setLogoError('');

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file (PNG, JPG, JPEG, WEBP, or SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo image size exceeds 5 MB. Please select a smaller image.');
      return;
    }

    setUploadingLogo(true);

    try {
      // 1. Read preview immediately for 0ms optimistic UI
      const reader = new FileReader();
      reader.onload = async () => {
        const previewUrl = reader.result as string;
        // Optimistic preview update
        setSettings(prev => ({ ...prev, companyLogoUrl: previewUrl }));

        try {
          // 2. Upload to server
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(`/api/settings/logo?_t=${Date.now()}`, {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (res.ok && data.success) {
            const finalLogoUrl = data.companyLogoUrl || previewUrl;
            const updated = { ...settings, companyLogoUrl: finalLogoUrl };
            setSettings(updated);
            notifySettingsUpdated(updated);
            setMessage('Company logo uploaded and updated successfully!');
            setTimeout(() => setMessage(''), 4000);
          } else {
            setLogoError(data.error || 'Failed to upload logo.');
          }
        } catch (err: unknown) {
          const errMessage = err instanceof Error ? err.message : 'Upload failed';
          setLogoError(errMessage);
        } finally {
          setUploadingLogo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingLogo(false);
      setLogoError('Could not read image file.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    setLogoError('');
    try {
      const res = await fetch(`/api/settings/logo?_t=${Date.now()}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const updated = { ...settings, companyLogoUrl: '' };
        setSettings(updated);
        notifySettingsUpdated(updated);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setMessage('Company logo removed.');
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (err) {
      setLogoError('Could not remove logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setLogoError('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        notifySettingsUpdated(settings);
        setMessage('Settings configurations saved successfully!');
        setTimeout(() => setMessage(''), 4000);
      } else {
        const data = await res.json();
        setLogoError(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      console.error(err);
      setLogoError('Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-slate-100 pb-12">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2.5">
            <Settings className="w-5 h-5 text-blue-400" />
            <span>Configuration Rules & Settings</span>
          </h2>
          <p className="text-xs text-slate-400">Manage organizational defaults, branding, shift policies, and portal URL assignments.</p>
        </div>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {logoError && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{logoError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: General Info & Branding */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Building className="w-4 h-4 text-blue-400" />
              <span>General Information & Branding</span>
            </h3>
            <span className="text-[11px] text-slate-400">Brand identity across top bar & login screen</span>
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Name</label>
            <input
              type="text"
              value={settings.companyName}
              onChange={e => setSettings({ ...settings, companyName: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="e.g. HRM Pilot"
            />
            <p className="text-[11px] text-slate-400 mt-1">Displayed in page headers, login greeting, and notifications.</p>
          </div>

          {/* Company Logo Upload & Preview */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <div>
                <label className="block text-xs font-semibold text-slate-200">Company Logo</label>
                <p className="text-[11px] text-slate-400">
                  Upload an image to replace default icons across the navigation bar and login page.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition self-start sm:self-auto flex items-center space-x-1"
              >
                <span>{showUrlInput ? 'Hide direct URL input' : 'Or enter logo image URL'}</span>
              </button>
            </div>

            {/* Hidden file input for native file browser */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              className="hidden"
            />

            {/* Active Logo Preview Card */}
            {settings.companyLogoUrl ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 transition">
                {/* Logo Preview Container with subtle dark pattern */}
                <div className="relative group p-2.5 rounded-xl bg-slate-950/80 border border-slate-700 flex items-center justify-center min-w-[130px] max-w-[180px] h-20 shrink-0 overflow-hidden shadow-inner">
                  <img
                    src={settings.companyLogoUrl}
                    alt="Company Logo Preview"
                    className="max-h-16 max-w-full object-contain transition-transform group-hover:scale-105"
                    onError={() => {
                      setLogoError('Unable to render image from current URL. Check image format or link.');
                    }}
                  />
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Details & Actions */}
                <div className="flex-1 text-center sm:text-left space-y-1 w-full min-w-0">
                  <div className="flex items-center justify-center sm:justify-start space-x-2">
                    <span className="text-xs font-bold text-white">Active Brand Logo</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Live
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate max-w-md font-mono">
                    {settings.companyLogoUrl.startsWith('data:')
                      ? 'Custom uploaded image (embedded data URL)'
                      : settings.companyLogoUrl}
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={handleRemoveLogo}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>

                    {!settings.companyLogoUrl.startsWith('data:') && (
                      <button
                        type="button"
                        onClick={() => window.open(settings.companyLogoUrl, '_blank')}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 text-xs font-semibold flex items-center space-x-1 transition"
                        title="View image in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Open</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Drag-and-Drop Upload Area when no logo exists */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2.5 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/60'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  {uploadingLogo ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-white">
                    <span className="text-blue-400 underline decoration-blue-400/50 hover:decoration-blue-400">
                      Click to upload
                    </span>{' '}
                    or drag and drop logo image
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PNG, JPG, WEBP, or SVG (max. 5 MB) • Recommended: 300×80px or square 200×200px
                  </p>
                </div>
              </div>
            )}

            {/* Optional Direct URL Input Field */}
            {showUrlInput && (
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2 mt-2">
                <label className="block text-xs font-semibold text-slate-300">Direct Logo Image URL</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="https://example.com/logo.png"
                      value={settings.companyLogoUrl}
                      onChange={e => setSettings({ ...settings, companyLogoUrl: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition font-mono"
                    />
                  </div>
                  {settings.companyLogoUrl && !settings.companyLogoUrl.startsWith('data:') && (
                    <button
                      type="button"
                      onClick={() => window.open(settings.companyLogoUrl, '_blank')}
                      className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center space-x-1 transition"
                      title="Open logo in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Provide an external CDN, AWS S3, or website image link.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Attendance Rules Defaults */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Attendance Rules Defaults</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Standard Shift Start Time</label>
              <input
                type="time"
                value={settings.shiftStartTime}
                onChange={e => setSettings({ ...settings, shiftStartTime: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Daily Lunch Break Deduction (Minutes)</label>
              <input
                type="number"
                value={settings.lunchBreakMinutes}
                onChange={e => setSettings({ ...settings, lunchBreakMinutes: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Half Day Hours Threshold (Minutes)</label>
              <input
                type="number"
                value={settings.halfDayThresholdMinutes}
                onChange={e => setSettings({ ...settings, halfDayThresholdMinutes: Number(e.target.value) })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Notification Rules & Automated Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                <span>Automated Notification Settings</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Configure automated alerts for leave applications, manager approvals, and real-time employee leave balance updates.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-300">Master Switch:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notificationSettings?.enabled ?? true}
                  onChange={e => {
                    const current = settings.notificationSettings || {
                      enabled: true,
                      notifyAdminOnLeaveApply: true,
                      notifyManagerOnLeaveApply: true,
                      notifyEmployeeLeaveBalance: true,
                      notifyEmployeeOnStatusUpdate: true,
                    };
                    setSettings({
                      ...settings,
                      notificationSettings: { ...current, enabled: e.target.checked },
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className={`space-y-3 transition-opacity ${settings.notificationSettings?.enabled ?? true ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            {/* Rule 1: Admin Notification on Leave Apply */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-white">Notify Admins & HR on Leave Application</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Admins and Super Admins receive instant notification whenever an employee submits a leave request, including employee department, dates, and reason.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notificationSettings?.notifyAdminOnLeaveApply ?? true}
                onChange={e => {
                  const current = settings.notificationSettings || {
                    enabled: true,
                    notifyAdminOnLeaveApply: true,
                    notifyManagerOnLeaveApply: true,
                    notifyEmployeeLeaveBalance: true,
                    notifyEmployeeOnStatusUpdate: true,
                  };
                  setSettings({
                    ...settings,
                    notificationSettings: { ...current, notifyAdminOnLeaveApply: e.target.checked },
                  });
                }}
                className="w-4 h-4 mt-1 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {/* Rule 2: Manager Notification on Leave Apply */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <UserCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-white">Notify Reporting Managers on Leave Application</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  The applicant’s primary and secondary reporting managers receive immediate alerts with a direct review link in the Manager Desk.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notificationSettings?.notifyManagerOnLeaveApply ?? true}
                onChange={e => {
                  const current = settings.notificationSettings || {
                    enabled: true,
                    notifyAdminOnLeaveApply: true,
                    notifyManagerOnLeaveApply: true,
                    notifyEmployeeLeaveBalance: true,
                    notifyEmployeeOnStatusUpdate: true,
                  };
                  setSettings({
                    ...settings,
                    notificationSettings: { ...current, notifyManagerOnLeaveApply: e.target.checked },
                  });
                }}
                className="w-4 h-4 mt-1 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {/* Rule 3: Employee Leave Balance on Apply */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-white">Send Leave Balance to Employees upon Application</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Employees immediately receive their current and projected quarterly leave balance (Casual, Planned/Sick, and total remaining) in their submission alert.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notificationSettings?.notifyEmployeeLeaveBalance ?? true}
                onChange={e => {
                  const current = settings.notificationSettings || {
                    enabled: true,
                    notifyAdminOnLeaveApply: true,
                    notifyManagerOnLeaveApply: true,
                    notifyEmployeeLeaveBalance: true,
                    notifyEmployeeOnStatusUpdate: true,
                  };
                  setSettings({
                    ...settings,
                    notificationSettings: { ...current, notifyEmployeeLeaveBalance: e.target.checked },
                  });
                }}
                className="w-4 h-4 mt-1 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {/* Rule 4: Employee Leave Balance on Status Update */}
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-xs font-bold text-white">Send Updated Leave Balance on Status Updates</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  When a manager or HR updates a request (Approved, Rejected, or Modified), employees receive live recalculated leave balances and deduction warnings.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notificationSettings?.notifyEmployeeOnStatusUpdate ?? true}
                onChange={e => {
                  const current = settings.notificationSettings || {
                    enabled: true,
                    notifyAdminOnLeaveApply: true,
                    notifyManagerOnLeaveApply: true,
                    notifyEmployeeLeaveBalance: true,
                    notifyEmployeeOnStatusUpdate: true,
                  };
                  setSettings({
                    ...settings,
                    notificationSettings: { ...current, notifyEmployeeOnStatusUpdate: e.target.checked },
                  });
                }}
                className="w-4 h-4 mt-1 accent-indigo-600 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Portal Pages Assignments */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Link2 className="w-4 h-4 text-purple-400" />
            <span>Frontend Portal Pages Assignments</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sign In Form Page URL</label>
              <input
                type="text"
                value={settings.loginUrl}
                onChange={e => setSettings({ ...settings, loginUrl: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Employee Dashboard Portal URL</label>
              <input
                type="text"
                value={settings.employeePortalUrl}
                onChange={e => setSettings({ ...settings, employeePortalUrl: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Manager Dashboard Portal URL</label>
              <input
                type="text"
                value={settings.managerPortalUrl}
                onChange={e => setSettings({ ...settings, managerPortalUrl: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || uploadingLogo}
            className="w-full md:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving Settings...' : 'Save Settings Configurations'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
