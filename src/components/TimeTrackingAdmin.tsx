'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Timer,
  Users,
  Coffee,
  Utensils,
  Moon,
  Power,
  Clock,
  Download,
  Plus,
  Pencil,
  Trash2,
  Square,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Home,
  Camera,
  CameraOff,
  Building2,
  Settings2,
  CalendarRange,
  ListChecks,
  Activity,
} from 'lucide-react';
import { BreakConfig, TimeActivity, TimeEntry, TimeTrackingSettings } from '@/lib/types';
import ScreenshotGallery from '@/components/ScreenshotGallery';
import {
  TrackerStatus,
  activityColor,
  addDays,
  entryBreakMs,
  entryWorkMs,
  formatClock,
  formatDuration,
  formatIstTime,
  isoToIstTimeInput,
  isScreenshotOverdue,
  SCREENSHOT_INTERVAL_OPTIONS,
  istDateKey,
  summarizeDay,
  weekStart,
  BREAK_MINUTES_MAX,
  BREAK_MINUTES_MIN,
  RETENTION_DAYS_MAX,
  RETENTION_DAYS_MIN,
  isValidBreakMinutes,
  isValidRetentionDays,
  normalizeBreaks,
  summarizeRange,
} from '@/lib/timeTracking';

interface TrackedEmployee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation?: string;
  status: string;
  workMode: string;
  trackingEnabled: boolean;
  trackingMandatory: boolean;
  screenshots: { enabled: boolean; intervalMinutes: number; isCustom: boolean };
  dailyWorkingRequirementMinutes: number;
}

interface AdminPayload {
  viewer: { role: string; name: string; canManage: boolean };
  employees: TrackedEmployee[];
  live: { employeeId: string; status: TrackerStatus; activeEntry: TimeEntry | null; lastScreenshotAt: string | null }[];
  settings: TimeTrackingSettings;
  entries: TimeEntry[];
  activities: TimeActivity[];
  serverTime: string;
  today: string;
  range: { from: string; to: string };
}

type TabId = 'live' | 'timesheets' | 'entries' | 'screenshots' | 'settings';
type RangePreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom';

interface EntryForm {
  id?: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  originalBreakMinutes?: number;
  activity: string;
  note: string;
}

const TRACKER_OFF_STYLE = { label: 'Tracker Off', pill: 'bg-slate-800/60 text-slate-500 border-slate-700 border-dashed', dot: 'bg-slate-700' };

const STATUS_STYLE: Record<TrackerStatus, { label: string; pill: string; dot: string }> = {
  WORKING: { label: 'Working', pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400 animate-pulse' },
  ON_BREAK: { label: 'On Break', pill: 'bg-amber-500/10 text-amber-300 border-amber-500/30', dot: 'bg-amber-400 animate-pulse' },
  OFF: { label: 'Offline', pill: 'bg-slate-800 text-slate-400 border-slate-700', dot: 'bg-slate-500' },
};

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function dayLabel(dateKey: string, withWeekday = false): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    ...(withWeekday ? { weekday: 'short' } : {}),
    timeZone: 'UTC',
  });
}

function presetRange(preset: RangePreset, today: string): { from: string; to: string } {
  const thisWeek = weekStart(today);
  if (preset === 'last-week') return { from: addDays(thisWeek, -7), to: addDays(thisWeek, -1) };
  if (preset === 'this-month') return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === 'last-month') {
    // Month-end: HR reviews the whole previous month and adds the hours manually.
    const lastDay = addDays(`${today.slice(0, 8)}01`, -1);
    return { from: `${lastDay.slice(0, 8)}01`, to: lastDay };
  }
  return { from: thisWeek, to: addDays(thisWeek, 6) };
}

function csvCell(v: string | number) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TimeTrackingAdmin() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [tab, setTab] = useState<TabId>('live');
  const [preset, setPreset] = useState<RangePreset>('this-week');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState<'ALL' | 'ON' | 'OFF'>('ALL');
  const [form, setForm] = useState<EntryForm | null>(null);
  const [formError, setFormError] = useState('');
  const [newActivity, setNewActivity] = useState({ name: '', color: '#3b82f6' });
  const [shotEmployee, setShotEmployee] = useState('');
  const [defaultsForm, setDefaultsForm] = useState<TimeTrackingSettings | null>(null);
  // Master Admin break form: raw input strings so invalid values can be shown and blocked.
  const [breakForm, setBreakForm] = useState<{ tea: string; lunch: string } | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const fetchData = useCallback(async (r?: { from: string; to: string } | null) => {
    try {
      const params = new URLSearchParams({ t: String(Date.now()) });
      if (r) {
        params.set('from', r.from);
        params.set('to', r.to);
      } else {
        const today = istDateKey();
        const def = presetRange('this-week', today);
        params.set('from', def.from);
        params.set('to', def.to);
      }
      const res = await fetch(`/api/time-tracking/admin?${params}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to load time tracking.');
      setData(payload);
      setClockOffset(new Date(payload.serverTime).getTime() - Date.now());
      setRange(prev => prev || payload.range);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load time tracking.');
    } finally {
      setLoading(false);
    }
  }, []);

  const rangeRef = React.useRef(range);
  rangeRef.current = range;
  useEffect(() => {
    fetchData();
    const poll = setInterval(() => fetchData(rangeRef.current), 30000);
    return () => clearInterval(poll);
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now() + clockOffset), 1000);
    return () => clearInterval(tick);
  }, [clockOffset]);

  const applyRange = (r: { from: string; to: string }, p: RangePreset) => {
    setPreset(p);
    setRange(r);
    fetchData(r);
  };

  const post = async (key: string, body: Record<string, unknown>, url = '/api/time-tracking/admin') => {
    setBusyKey(key);
    setFlash('');
    setError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Update failed.');
      setFlash(payload.message || 'Saved.');
      await fetchData(range);
      return true;
    } catch (err: any) {
      setError(err.message || 'Update failed.');
      return false;
    } finally {
      setBusyKey('');
    }
  };

  const canManage = Boolean(data?.viewer.canManage);
  // The tracker is optional for every employee (not only WFH), so all active employees are listed;
  // trackedEmployees = those who have it switched on.
  const allEmployees = useMemo(() => (data?.employees || []).filter(e => e.status !== 'INACTIVE'), [data]);
  const trackedEmployees = useMemo(() => allEmployees.filter(e => e.trackingEnabled), [allEmployees]);
  const empById = useMemo(() => new Map((data?.employees || []).map(e => [e.id, e])), [data]);
  const activities = data?.activities || [];
  const today = data?.today || istDateKey();

  const rangeDays = useMemo(() => {
    if (!range) return [];
    const days: string[] = [];
    for (let d = range.from; d <= range.to && days.length < 93; d = addDays(d, 1)) days.push(d);
    return days;
  }, [range]);

  const rangeEntries = (data?.entries || []).filter(e =>
    range && e.date >= range.from && e.date <= range.to && (employeeFilter === 'ALL' || e.employeeId === employeeFilter)
  );
  // Timesheet rows: everyone with the tracker on, plus anyone who has time logged in the range.
  const withEntries = new Set(rangeEntries.map(e => e.employeeId));
  const visibleTracked = allEmployees.filter(e =>
    employeeFilter === 'ALL' ? e.trackingEnabled || withEntries.has(e.id) : e.id === employeeFilter
  );

  const openAdd = () => {
    setFormError('');
    setForm({
      employeeId: employeeFilter !== 'ALL' ? employeeFilter : (trackedEmployees[0] || allEmployees[0])?.id || '',
      date: today,
      startTime: '10:00',
      endTime: '18:00',
      breakMinutes: 30,
      activity: activities.find(a => a.isActive)?.name || '',
      note: '',
    });
  };

  const openEdit = (e: TimeEntry) => {
    const breakMin = Math.round(entryBreakMs(e, nowMs) / 60000);
    setFormError('');
    setForm({
      id: e.id,
      employeeId: e.employeeId,
      date: e.date,
      startTime: isoToIstTimeInput(e.clockIn),
      endTime: isoToIstTimeInput(e.clockOut),
      breakMinutes: breakMin,
      originalBreakMinutes: breakMin,
      activity: e.activity,
      note: e.note || '',
    });
  };

  const submitForm = async () => {
    if (!form) return;
    if (!form.employeeId || !form.date || !form.startTime || !form.endTime) {
      setFormError('Employee, date, start and end time are required.');
      return;
    }
    const ok = await post('form', {
      action: form.id ? 'UPDATE_ENTRY' : 'ADD_ENTRY',
      ...form,
      keepBreaks: form.id ? form.breakMinutes === form.originalBreakMinutes : false,
    });
    if (ok) setForm(null);
  };

  const exportEntriesCsv = () => {
    if (!range) return;
    const rows: (string | number)[][] = [['Employee', 'Employee ID', 'Department', 'Date', 'Activity', 'Clock In', 'Clock Out', 'Logged-in (min)', 'Break (min)', 'Worked (min) = Logged-in - Break', 'Worked (hours)', 'Note', 'Source', 'Auto Clock-out']];
    rangeEntries.forEach(e => {
      const emp = empById.get(e.employeeId);
      const workMin = Math.round(entryWorkMs(e, nowMs) / 60000);
      rows.push([
        emp?.name || e.employeeId,
        emp?.employeeId || '',
        emp?.department || '',
        e.date,
        e.activity,
        formatIstTime(e.clockIn),
        e.clockOut ? formatIstTime(e.clockOut) : 'Running',
        workMin + Math.round(entryBreakMs(e, nowMs) / 60000),
        Math.round(entryBreakMs(e, nowMs) / 60000),
        workMin,
        (workMin / 60).toFixed(2),
        e.note || '',
        e.source === 'MANUAL' ? 'Added by HR' : 'Web',
        e.autoClosed ? 'Yes' : '',
      ]);
    });
    downloadCsv(`time-entries_${range.from}_to_${range.to}.csv`, rows);
  };

  const exportSummaryCsv = () => {
    if (!range) return;
    const header = ['Employee', 'Employee ID', 'Department', ...rangeDays.map(d => dayLabel(d, true)), 'Days Worked', 'Logged-in Hours', 'Break Hours', 'Worked Hours (Logged-in - Breaks)', 'Overtime / Extra Hours', 'Short Hours', 'Target Hours', 'Achievement %'];
    const rows: (string | number)[][] = [header];
    const h = (ms: number) => (ms / 3600000).toFixed(2);
    visibleTracked.forEach(emp => {
      const own = rangeEntries.filter(e => e.employeeId === emp.id);
      const r = summarizeRange(own, rangeDays, emp.dailyWorkingRequirementMinutes * 60000, nowMs);
      rows.push([
        emp.name,
        emp.employeeId,
        emp.department,
        ...r.perDay.map(d => h(d.workMs)),
        r.daysWorked,
        h(r.loggedMs),
        h(r.breakMs),
        h(r.workMs),
        h(r.overtimeMs),
        h(r.shortMs),
        h(r.targetMs),
        r.targetMs ? Math.round((r.workMs / r.targetMs) * 100) : 0,
      ]);
    });
    downloadCsv(`timesheet-summary_${range.from}_to_${range.to}.csv`, rows);
  };

  if (loading && !data) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-400 flex items-center space-x-2">
        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
        <span>Loading time tracking…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error || 'Time tracking unavailable.'}</span>
      </div>
    );
  }

  // ---- Live board numbers ----
  const liveRows = allEmployees.map(emp => {
    const live = data.live.find(l => l.employeeId === emp.id);
    const todaySummary = summarizeDay(data.entries.filter(e => e.employeeId === emp.id), today, nowMs);
    const status = live?.status || ('OFF' as TrackerStatus);
    const active = live?.activeEntry || null;
    const lastBreakEnd = active?.breaks.filter(b => b.end).map(b => b.end!).pop();
    const shotsOverdue = status === 'WORKING' && emp.screenshots.enabled && active
      ? isScreenshotOverdue(live?.lastScreenshotAt || undefined, lastBreakEnd && lastBreakEnd > active.clockIn ? lastBreakEnd : active.clockIn, emp.screenshots.intervalMinutes, nowMs)
      : false;
    // A session still running (e.g. tracker switched off mid-day) counts as on.
    const trackerOn = emp.trackingEnabled || status !== 'OFF';
    return { emp, status, active, todaySummary, lastShotAt: live?.lastScreenshotAt || null, shotsOverdue, trackerOn };
  });
  const workingCount = liveRows.filter(r => r.status === 'WORKING').length;
  const breakCount = liveRows.filter(r => r.status === 'ON_BREAK').length;
  const notStarted = liveRows.filter(r => r.trackerOn && r.status === 'OFF' && r.todaySummary.sessions === 0).length;
  const trackerOffCount = liveRows.filter(r => !r.trackerOn).length;
  const teamTodayMs = liveRows.reduce((s, r) => s + r.todaySummary.workMs, 0);
  const statusOrder: Record<TrackerStatus, number> = { WORKING: 0, ON_BREAK: 1, OFF: 2 };
  liveRows.sort((a, b) =>
    Number(b.trackerOn) - Number(a.trackerOn) || statusOrder[a.status] - statusOrder[b.status] || a.emp.name.localeCompare(b.emp.name)
  );
  const boardRows = liveRows.filter(r => boardFilter === 'ALL' || (boardFilter === 'ON') === r.trackerOn);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'live', label: 'Live Board', icon: Activity },
    { id: 'timesheets', label: 'Timesheets', icon: CalendarRange },
    { id: 'entries', label: 'Time Entries', icon: ListChecks },
    { id: 'screenshots', label: 'Screenshots', icon: Camera },
    ...(canManage ? [{ id: 'settings' as TabId, label: 'Who Can Track', icon: Settings2 }] : []),
  ];

  const rangeBar = range && (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
      <div className="flex flex-wrap gap-1.5">
        {([['this-week', 'This Week'], ['last-week', 'Last Week'], ['this-month', 'This Month'], ['last-month', 'Last Month']] as [RangePreset, string][]).map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => applyRange(presetRange(p, today), p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${preset === p ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <input type="date" value={range.from} max={range.to} onChange={e => e.target.value && applyRange({ from: e.target.value, to: range.to }, 'custom')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white [color-scheme:dark]" />
        <span className="text-slate-500">to</span>
        <input type="date" value={range.to} min={range.from} onChange={e => e.target.value && applyRange({ from: range.from, to: e.target.value }, 'custom')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white [color-scheme:dark]" />
      </div>
      <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="lg:ml-auto px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-white">
        <option value="ALL">All employees ({allEmployees.length})</option>
        {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employeeId}){e.trackingEnabled ? '' : ' · tracker off'}</option>)}
      </select>
    </div>
  );

  return (
    <div className="tt-root space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-purple-300 text-[11px] font-black uppercase tracking-wider">
            <Timer className="w-3.5 h-3.5" />
            <span>Time Tracking</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white font-heading">Time Tracker</h1>
          <p className="text-xs text-slate-400">
            Optional for every employee (office or WFH) — whoever turns it on is tracked: live clock-in status, breaks, timesheets and screenshots
            {!canManage && data.viewer.name ? ` · team of ${data.viewer.name}` : ''}.
          </p>
        </div>
        <button type="button" onClick={() => fetchData(range)} className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex items-center space-x-2 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {(flash || error) && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border ${error ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          <span className="flex items-center space-x-2">
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{error || flash}</span>
          </span>
          <button type="button" onClick={() => { setError(''); setFlash(''); }} className="opacity-70 hover:opacity-100 cursor-pointer" aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none p-1 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${tab === t.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {allEmployees.length === 0 && tab !== 'settings' && (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
          <Home className="w-7 h-7 text-purple-400 mx-auto" />
          <p className="text-sm font-bold text-white">No employees to show yet</p>
          <p className="text-xs text-slate-400">
            {canManage ? 'The tracker is optional — any employee can switch it on from their own portal, or you can switch it on for them in "Who Can Track".' : 'No team members report to you yet.'}
          </p>
          {canManage && (
            <button type="button" onClick={() => setTab('settings')} className="mt-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer">Open Who Can Track</button>
          )}
        </div>
      )}

      {/* LIVE BOARD */}
      {tab === 'live' && allEmployees.length > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { label: 'Working now', value: workingCount, icon: Timer, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
              { label: 'On break', value: breakCount, icon: Coffee, color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
              { label: 'Not started today', value: notStarted, icon: Moon, color: 'text-slate-300 bg-slate-800 border-slate-700' },
              { label: 'Tracker off', value: trackerOffCount, icon: Power, color: 'text-slate-400 bg-slate-800 border-slate-700' },
              { label: 'Team hours today', value: formatDuration(teamTodayMs), icon: Clock, color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
            ].map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-400">{c.label}</p>
                    <p className="text-2xl font-extrabold text-white font-heading">{c.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${c.color}`}><Icon className="w-5 h-5" /></div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {([['ALL', `All employees (${liveRows.length})`], ['ON', `Tracker on (${liveRows.length - trackerOffCount})`], ['OFF', `Tracker off (${trackerOffCount})`]] as ['ALL' | 'ON' | 'OFF', string][]).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setBoardFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${boardFilter === f ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {boardRows.length === 0 && (
              <p className="col-span-full p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">No employees in this view.</p>
            )}
            {boardRows.map(({ emp, status, active, todaySummary, lastShotAt, shotsOverdue, trackerOn }) => {
              const st = trackerOn ? STATUS_STYLE[status] : TRACKER_OFF_STYLE;
              const target = emp.dailyWorkingRequirementMinutes * 60000;
              const pct = Math.min(100, Math.round((todaySummary.workMs / target) * 100));
              const lastBreak = active?.breaks[active.breaks.length - 1];
              return (
                <div key={emp.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-xs font-black text-white">{initials(emp.name)}</div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-slate-900 ${st.dot}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">{emp.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{emp.designation || emp.department} · {emp.employeeId}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${st.pill}`}>{st.label}</span>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black text-white font-mono tabular-nums">{formatClock(todaySummary.workMs)}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {status === 'WORKING' && active && (
                          <>
                            <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: activityColor(activities, active.activity) }} />
                            {active.activity} · since {formatIstTime(active.clockIn)}
                          </>
                        )}
                        {status === 'ON_BREAK' && lastBreak && `${lastBreak.name || (lastBreak.type === 'lunch' ? 'Lunch Break' : 'Tea Break')} since ${formatIstTime(lastBreak.start)}`}
                        {status === 'OFF' && (todaySummary.sessions > 0 ? `Clocked out ${formatIstTime(todaySummary.lastOut)}` : trackerOn ? 'Not clocked in today' : 'Has not turned on the tracker')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold text-slate-400">{pct}% of {formatDuration(target)}</p>
                      {todaySummary.workMs > target && (
                        <p className="text-[10px] font-extrabold text-emerald-400">+{formatDuration(todaySummary.workMs - target)} OT</p>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {active?.note && <p className="text-[11px] text-slate-500 italic truncate">“{active.note}”</p>}
                  {!trackerOn ? (
                    <p className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                      <Power className="w-3.5 h-3.5 shrink-0" />
                      <span>Tracker off — tracked once {canManage ? 'the employee or HR turns it on' : 'the employee turns it on'}</span>
                    </p>
                  ) : emp.screenshots.enabled ? (
                    shotsOverdue ? (
                      <p className="text-[11px] font-bold text-rose-300 flex items-center space-x-1.5">
                        <CameraOff className="w-3.5 h-3.5 shrink-0" />
                        <span>No screenshots{lastShotAt ? ` since ${formatIstTime(lastShotAt)}` : ' yet'} — screen sharing may be off</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 flex items-center space-x-1.5">
                        <Camera className="w-3.5 h-3.5 shrink-0 text-purple-300" />
                        <span>Every {emp.screenshots.intervalMinutes} min{lastShotAt ? ` · last ${formatIstTime(lastShotAt)}` : ''}</span>
                      </p>
                    )
                  ) : (
                    <p className="text-[11px] text-slate-500 flex items-center space-x-1.5"><CameraOff className="w-3.5 h-3.5 shrink-0" /><span>Screenshots off</span></p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setEmployeeFilter(emp.id); setTab('timesheets'); }} className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 hover:text-white cursor-pointer">
                      Timesheet
                    </button>
                    <button type="button" onClick={() => { setShotEmployee(emp.id); setTab('screenshots'); }} className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 hover:text-white flex items-center justify-center space-x-1.5 cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Screenshots</span>
                    </button>
                    {canManage && !trackerOn && (
                      <button
                        type="button"
                        disabled={busyKey === `track-${emp.id}`}
                        onClick={() => post(`track-${emp.id}`, { action: 'SET_TRACKING', employeeId: emp.id, enabled: true })}
                        className="px-3 py-2 rounded-xl bg-purple-600/15 border border-purple-500/40 text-[11px] font-bold text-purple-200 hover:bg-purple-600/25 flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{busyKey === `track-${emp.id}` ? 'Turning on…' : 'Turn on'}</span>
                      </button>
                    )}
                    {canManage && status !== 'OFF' && (
                      <button
                        type="button"
                        disabled={busyKey === `out-${emp.id}`}
                        onClick={() => { if (confirm(`Clock out ${emp.name} now?`)) post(`out-${emp.id}`, { action: 'FORCE_CLOCK_OUT', employeeId: emp.id }); }}
                        className="px-3 py-2 rounded-xl bg-rose-600/15 border border-rose-500/40 text-[11px] font-bold text-rose-300 hover:bg-rose-600/25 flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Clock out</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TIMESHEETS */}
      {tab === 'timesheets' && allEmployees.length > 0 && range && (
        <div className="space-y-4">
          {rangeBar}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-white">Timesheet Summary</h3>
                <p className="text-[11px] text-slate-400">{dayLabel(range.from)} – {dayLabel(range.to)} · hours worked per day (breaks excluded)</p>
                <p className="mt-1 text-[11px] font-semibold text-amber-300">
                  Separate from the attendance sheet — these hours are never added to attendance, working hours or payroll automatically. At month end, use &quot;Last Month&quot; + Summary CSV and add the hours manually.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={exportSummaryCsv} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /><span>Summary CSV</span>
                </button>
                <button type="button" onClick={exportEntriesCsv} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /><span>Detailed CSV</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400 bg-slate-800/40">
                    <th className="px-4 py-3 font-black sticky left-0 bg-slate-900 z-10 min-w-[160px]">Employee</th>
                    {rangeDays.length <= 14 && rangeDays.map(d => (
                      <th key={d} className={`px-2 py-3 font-black text-center whitespace-nowrap ${d === today ? 'text-purple-300' : ''}`}>{dayLabel(d, true)}</th>
                    ))}
                    <th className="px-3 py-3 font-black text-center">Days</th>
                    <th className="px-3 py-3 font-black text-right">Break</th>
                    <th className="px-3 py-3 font-black text-right">Worked</th>
                    <th className="px-3 py-3 font-black text-right text-emerald-400">Overtime / Extra</th>
                    <th className="px-4 py-3 font-black text-right">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {visibleTracked.map(emp => {
                    const own = rangeEntries.filter(e => e.employeeId === emp.id);
                    const dayTarget = emp.dailyWorkingRequirementMinutes * 60000;
                    const r = summarizeRange(own, rangeDays, dayTarget, nowMs);
                    const perDay = r.perDay;
                    const total = r.workMs;
                    const breaks = r.breakMs;
                    const worked = r.daysWorked;
                    const achievement = worked ? Math.round((total / r.targetMs) * 100) : 0;
                    const extraMs = r.overtimeMs;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 sticky left-0 bg-slate-900 z-10">
                          <p className="font-bold text-white">{emp.name}</p>
                          <p className="text-[10px] text-slate-500">{emp.employeeId} · {emp.department}</p>
                        </td>
                        {rangeDays.length <= 14 && perDay.map(d => (
                          <td key={d.date} className="px-2 py-3 text-center font-mono tabular-nums">
                            {d.workMs > 0 ? (
                              <span className={d.workMs >= dayTarget ? 'text-emerald-300 font-bold' : 'text-slate-200'}>{(d.workMs / 3600000).toFixed(1)}h</span>
                            ) : <span className="text-slate-700">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-center font-bold text-slate-200">{worked}</td>
                        <td className="px-3 py-3 text-right font-mono text-amber-300/90">{formatDuration(breaks)}</td>
                        <td className="px-3 py-3 text-right font-mono font-extrabold text-white">{formatDuration(total)}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold">
                          {extraMs > 0 ? (
                            <span className="text-emerald-400 font-extrabold" title="Sum of each day's overtime, after deducting breaks">+{formatDuration(extraMs)}</span>
                          ) : null}
                          {r.shortMs > 0 && (
                            <span className="block text-[10px] text-slate-500" title="Sum of each day's shortfall">-{formatDuration(r.shortMs)} short</span>
                          )}
                          {extraMs === 0 && r.shortMs === 0 && <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${achievement >= 100 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : achievement >= 80 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
                            {worked ? `${achievement}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rangeDays.length > 14 && <p className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-800">Per-day columns are hidden for ranges longer than 14 days — use the Summary CSV for day-wise hours.</p>}
          </div>
        </div>
      )}

      {/* ENTRIES */}
      {tab === 'entries' && allEmployees.length > 0 && range && (
        <div className="space-y-4">
          {rangeBar}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-white">Time Entries ({rangeEntries.length})</h3>
                <p className="text-[11px] text-slate-400">Every clock-in session. {canManage ? 'Correct mistakes or add missed time — the employee is notified.' : 'Read-only view for managers.'}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={exportEntriesCsv} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /><span>CSV</span>
                </button>
                {canManage && (
                  <button type="button" onClick={openAdd} className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /><span>Add manual entry</span>
                  </button>
                )}
              </div>
            </div>

            {rangeEntries.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No time entries in this range.</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {[...rangeEntries].reverse().map(e => {
                  const emp = empById.get(e.employeeId);
                  return (
                    <div key={e.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-800/30">
                      <div className="flex items-center space-x-3 min-w-0 md:w-56 shrink-0">
                        <span className="w-2 h-10 rounded-full shrink-0" style={{ background: activityColor(activities, e.activity) }} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{emp?.name || e.employeeId}</p>
                          <p className="text-[10px] text-slate-500">{dayLabel(e.date, true)}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200">
                          <strong>{e.activity}</strong> · {formatIstTime(e.clockIn)} → {e.clockOut ? formatIstTime(e.clockOut) : <span className="text-emerald-300 font-bold">running</span>}
                          {e.breaks.length > 0 && <span className="text-slate-400"> · break {formatDuration(entryBreakMs(e, nowMs))}</span>}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {e.source === 'MANUAL' && <span className="text-blue-300 font-bold mr-2">Manual</span>}
                          {e.autoClosed && <span className="text-amber-300 font-bold mr-2">Auto clock-out (forgot to clock out)</span>}
                          {e.editedBy && <span className="mr-2">Edited by {e.editedBy}</span>}
                          {e.note && <span className="italic">“{e.note}”</span>}
                        </p>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                        <span className="text-sm font-extrabold font-mono text-white tabular-nums">{formatDuration(entryWorkMs(e, nowMs))}</span>
                        {canManage && (
                          <div className="flex gap-1.5">
                            <button type="button" disabled={!e.clockOut} title={e.clockOut ? 'Edit' : 'Clock out first to edit'} onClick={() => openEdit(e)} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer" aria-label="Edit entry">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={busyKey === `del-${e.id}`}
                              onClick={() => { if (confirm('Delete this time entry? The employee will be notified.')) post(`del-${e.id}`, { action: 'DELETE_ENTRY', id: e.id }); }}
                              className="p-2 rounded-lg bg-rose-600/10 border border-rose-500/30 text-rose-300 hover:bg-rose-600/20 disabled:opacity-40 cursor-pointer"
                              aria-label="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SCREENSHOTS */}
      {tab === 'screenshots' && allEmployees.length > 0 && (() => {
        const selected = allEmployees.find(e => e.id === shotEmployee) || trackedEmployees[0] || allEmployees[0];
        const cfg = selected.screenshots;
        const key = `shot-${selected.id}`;
        return (
          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden h-fit">
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-extrabold text-white">Employees</h3>
                <p className="text-[11px] text-slate-400">Each employee has their own gallery.</p>
              </div>
              <div className="divide-y divide-slate-800 max-h-[520px] overflow-y-auto">
                {[...allEmployees].sort((a, b) => Number(b.trackingEnabled) - Number(a.trackingEnabled) || a.name.localeCompare(b.name)).map(e => {
                  const row = liveRows.find(r => r.emp.id === e.id);
                  const isSel = e.id === selected.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setShotEmployee(e.id)}
                      className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-left cursor-pointer ${isSel ? 'bg-purple-600/15' : 'hover:bg-slate-800/30'}`}
                    >
                      <span className="min-w-0">
                        <span className={`block text-xs font-bold truncate ${isSel ? 'text-purple-300' : 'text-white'}`}>{e.name}</span>
                        <span className="block text-[10px] text-slate-500">
                          {e.trackingEnabled ? '' : 'Tracker off · '}{e.screenshots.enabled ? `Every ${e.screenshots.intervalMinutes} min${e.screenshots.isCustom ? ' · custom' : ''}` : 'Screenshots off'}
                        </span>
                      </span>
                      {row?.shotsOverdue
                        ? <span title="No recent screenshots"><CameraOff className="w-4 h-4 text-rose-300" /></span>
                        : <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_STYLE[row?.status || 'OFF'].dot}`} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 min-w-0">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-white">{selected.name} · screenshot settings</p>
                  <p className="text-[11px] text-slate-400">
                    {cfg.isCustom ? 'Custom setting for this employee.' : `Following the company default (${data.settings.screenshotsEnabledByDefault ? `every ${data.settings.defaultScreenshotIntervalMinutes} min` : 'off'}).`}
                    {' '}Changes reach the employee&apos;s tracker within 30 seconds, even mid-session.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-[11px] font-bold text-slate-300">Screenshots</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cfg.enabled}
                    aria-label={`Screenshots for ${selected.name}`}
                    disabled={busyKey === key}
                    onClick={() => post(key, { action: 'SET_EMPLOYEE', employeeId: selected.id, enabled: !cfg.enabled }, '/api/time-tracking/screenshots/settings')}
                    className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 cursor-pointer ${cfg.enabled ? 'bg-purple-600' : 'bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${cfg.enabled ? 'translate-x-5' : ''}`} />
                  </button>
                  <select
                    value={cfg.intervalMinutes}
                    disabled={!cfg.enabled || busyKey === key}
                    onChange={e => post(key, { action: 'SET_EMPLOYEE', employeeId: selected.id, intervalMinutes: Number(e.target.value) }, '/api/time-tracking/screenshots/settings')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-white disabled:opacity-50"
                    aria-label="Screenshot interval"
                  >
                    {SCREENSHOT_INTERVAL_OPTIONS.map(m => <option key={m} value={m}>Every {m} min</option>)}
                  </select>
                  {cfg.isCustom && (
                    <button
                      type="button"
                      disabled={busyKey === key}
                      onClick={() => post(key, { action: 'SET_EMPLOYEE', employeeId: selected.id, reset: true }, '/api/time-tracking/screenshots/settings')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
                    >
                      Use company default
                    </button>
                  )}
                </div>
              </div>
              <ScreenshotGallery key={selected.id} employeeId={selected.id} employeeName={selected.name} activities={activities} />
            </div>
          </div>
        );
      })()}

      {/* SETTINGS */}
      {tab === 'settings' && canManage && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 space-y-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">Who can use the time tracker?</h3>
                <p className="text-[11px] text-slate-400">The tracker is optional for every employee (office or WFH) — anyone can turn it on themselves from their portal, and you can also turn it on/off here. Employees in permanent Work From Home mode are always tracked. Screenshot on/off and interval per employee are in the Screenshots tab.</p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee, ID or department…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="divide-y divide-slate-800 max-h-[560px] overflow-y-auto">
              {data.employees
                .filter(e => {
                  const q = search.toLowerCase().trim();
                  return !q || [e.name, e.employeeId, e.department, e.email].some(v => (v || '').toLowerCase().includes(q));
                })
                .sort((a, b) => Number(b.trackingEnabled) - Number(a.trackingEnabled) || a.name.localeCompare(b.name))
                .map(e => {
                  const isOn = e.trackingEnabled;
                  const locked = e.trackingMandatory;
                  return (
                    <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black shrink-0 ${isOn ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{initials(e.name)}</div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{e.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{e.employeeId} · {e.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className={`hidden sm:inline-flex items-center space-x-1 text-[10px] font-bold ${isOn ? 'text-purple-300' : 'text-slate-500'}`}>
                          {locked ? <Home className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          <span>{locked ? 'WFH mode · always on' : isOn ? 'Tracker on' : 'Tracker off'}</span>
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOn}
                          aria-label={`Time tracker for ${e.name}`}
                          title={locked ? 'Always on for Work From Home mode' : undefined}
                          disabled={locked || busyKey === `trk-${e.id}`}
                          onClick={() => {
                            if (isOn && !confirm(`Turn off the time tracker for ${e.name}? Any running session will be clocked out.`)) return;
                            post(`trk-${e.id}`, { action: 'SET_TRACKING', employeeId: e.id, enabled: !isOn });
                          }}
                          className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${isOn ? 'bg-purple-600' : 'bg-slate-700'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : ''}`} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="space-y-6">
          {canManage && (() => {
            const saved = normalizeBreaks(data.settings?.breaks);
            const savedTea = saved.find(b => b.id === 'tea')!.durationMinutes;
            const savedLunch = saved.find(b => b.id === 'lunch')!.durationMinutes;
            const bf = breakForm || { tea: String(savedTea), lunch: String(savedLunch) };
            const checkMinutes = (label: string, raw: string) => {
              const n = Number(raw);
              return raw.trim() !== '' && isValidBreakMinutes(n) ? '' : `${label}: enter whole minutes from ${BREAK_MINUTES_MIN} to ${BREAK_MINUTES_MAX}.`;
            };
            const teaErr = checkMinutes('Tea Break', bf.tea);
            const lunchErr = checkMinutes('Lunch Break', bf.lunch);
            const dirty = Boolean(breakForm) && (bf.tea !== String(savedTea) || bf.lunch !== String(savedLunch));
            const rows: { key: 'tea' | 'lunch'; label: string; icon: typeof Coffee; err: string }[] = [
              { key: 'tea', label: 'Tea Break Duration', icon: Coffee, err: teaErr },
              { key: 'lunch', label: 'Lunch Break Duration', icon: Utensils, err: lunchErr },
            ];
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                    <Coffee className="w-4 h-4 text-amber-400" />
                    <span>Break Settings (Master Admin)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Two breaks: Tea (default 15 min) and Lunch (default 45 min). Break time is not counted as working time, so it is deducted before overtime is calculated.
                  </p>
                </div>

                <div className="space-y-2">
                  {rows.map(r => (
                    <div key={r.key} className="space-y-1">
                      <label className={`p-2.5 rounded-xl bg-slate-800/60 border flex items-center justify-between gap-2 ${r.err ? 'border-rose-500/60' : 'border-slate-700/60'}`}>
                        <span className="flex items-center space-x-2 min-w-0">
                          <r.icon className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="font-bold text-xs text-white">{r.label}</span>
                        </span>
                        <span className="flex items-center space-x-1.5 shrink-0">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={BREAK_MINUTES_MIN}
                            max={BREAK_MINUTES_MAX}
                            step={1}
                            value={bf[r.key]}
                            onChange={e => setBreakForm({ ...bf, [r.key]: e.target.value })}
                            aria-invalid={Boolean(r.err)}
                            className="w-16 px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-center text-white"
                          />
                          <span className="text-[10px] text-slate-400 font-semibold">min</span>
                        </span>
                      </label>
                      {r.err && <p className="text-[10px] text-rose-300 font-semibold px-1">{r.err}</p>}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!dirty || Boolean(teaErr || lunchErr) || busyKey === 'breaks'}
                  onClick={async () => {
                    if (await post('breaks', { action: 'SET_BREAKS', teaMinutes: Number(bf.tea), lunchMinutes: Number(bf.lunch) }, '/api/time-tracking/screenshots/settings')) {
                      setBreakForm(null);
                    }
                  }}
                  className="w-full px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  {busyKey === 'breaks' ? 'Saving…' : 'Save Break Settings'}
                </button>
              </div>
            );
          })()}

          {canManage && (() => {
            const df = defaultsForm || data.settings;
            const dirty = Boolean(defaultsForm) && JSON.stringify(defaultsForm) !== JSON.stringify(data.settings);
            const retentionOk = isValidRetentionDays(df.screenshotRetentionDays);
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center space-x-2"><Camera className="w-4 h-4 text-purple-400" /><span>Screenshot defaults</span></h3>
                  <p className="text-[11px] text-slate-400">Applies to everyone without a custom setting. Capture starts when an employee clocks in.</p>
                </div>
                <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-200">
                  <span>Take screenshots by default</span>
                  <input type="checkbox" checked={df.screenshotsEnabledByDefault} onChange={e => setDefaultsForm({ ...df, screenshotsEnabledByDefault: e.target.checked })} className="w-4 h-4 accent-purple-600" />
                </label>
                <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-200">
                  <span>Default interval</span>
                  <select value={df.defaultScreenshotIntervalMinutes} onChange={e => setDefaultsForm({ ...df, defaultScreenshotIntervalMinutes: Number(e.target.value) })} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white">
                    {SCREENSHOT_INTERVAL_OPTIONS.map(m => <option key={m} value={m}>Every {m} min</option>)}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-200">
                  <span>Keep screenshots for (days)</span>
                  <input type="number" inputMode="numeric" min={RETENTION_DAYS_MIN} max={RETENTION_DAYS_MAX} step={1} value={Number.isNaN(df.screenshotRetentionDays) ? '' : df.screenshotRetentionDays} onChange={e => setDefaultsForm({ ...df, screenshotRetentionDays: e.target.value === '' ? NaN : Number(e.target.value) })} aria-invalid={!retentionOk} className={`w-20 px-2.5 py-1.5 rounded-lg bg-slate-800 border text-xs text-white ${retentionOk ? 'border-slate-700' : 'border-rose-500'}`} />
                </label>
                {retentionOk
                  ? <p className="text-[10px] text-slate-500">Screenshots older than {df.screenshotRetentionDays} days are permanently deleted automatically (image files and records). Attendance and time entries are never deleted.</p>
                  : <p className="text-[10px] text-rose-300 font-semibold">Screenshot retention: enter whole days from {RETENTION_DAYS_MIN} to {RETENTION_DAYS_MAX}.</p>}
                <button
                  type="button"
                  disabled={!dirty || !retentionOk || busyKey === 'defaults'}
                  onClick={async () => { if (await post('defaults', { action: 'SET_DEFAULTS', ...df }, '/api/time-tracking/screenshots/settings')) setDefaultsForm(null); }}
                  className="w-full px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  {busyKey === 'defaults' ? 'Saving…' : 'Save defaults'}
                </button>
              </div>
            );
          })()}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-4 space-y-4 h-fit">
            <div>
              <h3 className="text-sm font-extrabold text-white">Activities</h3>
              <p className="text-[11px] text-slate-400">What employees pick when they clock in. Hidden activities stay on old entries.</p>
            </div>
            <div className="space-y-2">
              {activities.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/50">
                  <span className={`flex items-center space-x-2 text-xs font-semibold ${a.isActive ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                    <span className="w-3 h-3 rounded-full" style={{ background: a.color }} />
                    <span>{a.name}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busyKey === `act-${a.id}`}
                    onClick={() => post(`act-${a.id}`, { action: 'TOGGLE_ACTIVITY', id: a.id })}
                    className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    {a.isActive ? 'Hide' : 'Show'}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="color" value={newActivity.color} onChange={e => setNewActivity(p => ({ ...p, color: e.target.value }))} className="w-10 h-9 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer" aria-label="Activity color" />
              <input value={newActivity.name} onChange={e => setNewActivity(p => ({ ...p, name: e.target.value }))} placeholder="New activity name" maxLength={40} className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500" />
              <button
                type="button"
                disabled={!newActivity.name.trim() || busyKey === 'act-new'}
                onClick={async () => { if (await post('act-new', { action: 'ADD_ACTIVITY', ...newActivity })) setNewActivity({ name: '', color: '#3b82f6' }); }}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                aria-label="Add activity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Add / edit entry modal */}
      {form && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setForm(null)} />
          <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">{form.id ? 'Edit time entry' : 'Add manual time entry'}</h3>
              <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="font-bold text-slate-300">Employee</span>
                <select disabled={Boolean(form.id)} value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white disabled:opacity-60">
                  {allEmployees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>)}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block space-y-1 col-span-3 sm:col-span-1">
                  <span className="font-bold text-slate-300">Date</span>
                  <input type="date" max={today} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full px-2 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white [color-scheme:dark]" />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-300">Start</span>
                  <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full px-2 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white [color-scheme:dark]" />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-300">End</span>
                  <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full px-2 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white [color-scheme:dark]" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="font-bold text-slate-300">Break (minutes)</span>
                  <input type="number" min={0} max={600} value={form.breakMinutes} onChange={e => setForm({ ...form, breakMinutes: Math.max(0, Number(e.target.value) || 0) })} className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white" />
                </label>
                <label className="block space-y-1">
                  <span className="font-bold text-slate-300">Activity</span>
                  <select value={form.activity} onChange={e => setForm({ ...form, activity: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white">
                    {activities.filter(a => a.isActive || a.name === form.activity).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="block space-y-1">
                <span className="font-bold text-slate-300">Reason / note</span>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} maxLength={300} placeholder="e.g. Forgot to clock in — confirmed on call" className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500" />
              </label>
              <p className="text-[10px] text-slate-500">Times are in IST. An end time earlier than the start means the session ended after midnight.</p>
              {formError && <p className="text-rose-300 font-semibold">{formError}</p>}
              {error && <p className="text-rose-300 font-semibold">{error}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer">Cancel</button>
              <button type="button" disabled={busyKey === 'form'} onClick={submitForm} className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
                {busyKey === 'form' ? 'Saving…' : form.id ? 'Save changes' : 'Add entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'live' && allEmployees.length > 0 && (
        <p className="text-[10px] text-slate-500 flex items-center space-x-1.5">
          <Users className="w-3 h-3" />
          <span>Updates automatically every 30 seconds. Sessions left running for 14 hours or past midnight are auto clocked-out.</span>
        </p>
      )}
    </div>
  );
}
