'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Clock, Building, Link2, CheckCircle2 } from 'lucide-react';
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
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage('Settings configurations saved successfully!');
        setTimeout(() => setMessage(''), 4000);
      }
    } catch (err) {
      console.error(err);
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
          <p className="text-xs text-slate-400">Manage organizational defaults, shift policies, and portal URL assignments.</p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: General Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
            <Building className="w-4 h-4 text-blue-400" />
            <span>General Information</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Company Logo URL</label>
              <input
                type="text"
                placeholder="https://example.com/logo.png"
                value={settings.companyLogoUrl}
                onChange={e => setSettings({ ...settings, companyLogoUrl: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
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

        {/* Section 3: Portal Pages Assignments */}
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
            disabled={loading}
            className="w-full md:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Settings Configurations'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
