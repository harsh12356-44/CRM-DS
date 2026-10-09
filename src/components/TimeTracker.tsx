'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Play,
  Square,
  Coffee,
  Utensils,
  RotateCcw,
  Timer,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Repeat,
  Eye,
  Home,
  Camera,
  MonitorUp,
} from 'lucide-react';
import { BreakConfig, TimeActivity, TimeEntry } from '@/lib/types';
import { CaptureState, getScreenCapture } from '@/lib/screenCapture';
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
  istDateKey,
  summarizeDay,
  weekStart,
  DEFAULT_BREAK_CONFIGS,
  computeExtraHours,
  summarizeRange,
} from '@/lib/timeTracking';

interface TrackerPayload {
  employee: { id: string; name: string; dailyWorkingRequirementMinutes: number; workMode: string };
  enabled: boolean;
  mandatory: boolean;
  canEdit: boolean;
  status: TrackerStatus;
  activeEntry: TimeEntry | null;
  breaksConfig?: BreakConfig[];
  entries: TimeEntry[];
  activities: TimeActivity[];
  screenshots: {
    enabled: boolean;
    intervalMinutes?: number;
    intervalMinMinutes?: number;
    intervalMaxMinutes?: number;
    lastAt: string | null;
    todayCount: number;
  };
  serverTime: string;
  today: string;
}

interface TimeTrackerProps {
  employeeId: string;
  compact?: boolean;
}

const IDLE_PROMPT_MS = 30 * 60 * 1000;
const POLL_MS = 5 * 1000;
const MAX_WEEKS_BACK = 8;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

function agoLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function TimeTracker({ employeeId, compact = false }: TimeTrackerProps) {
  const [data, setData] = useState<TrackerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [activity, setActivity] = useState('');
  const [note, setNote] = useState('');
  const [weekAnchor, setWeekAnchor] = useState<string>('');
  const [clockOffset, setClockOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [idlePrompt, setIdlePrompt] = useState(false);
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const lastInteraction = useRef(Date.now());

  useEffect(() => {
    const mgr = getScreenCapture();
    return mgr ? mgr.subscribe(setCapture) : undefined;
  }, []);

  const today = data?.today || '';
  const currentWeek = today ? weekStart(today) : '';
  const viewWeek = weekAnchor || currentWeek;

  const rangeFor = useCallback((week: string, todayKey: string) => {
    const weekEnd = addDays(week, 6);
    return { from: week, to: weekEnd > todayKey ? weekEnd : todayKey };
  }, []);

  const applyPayload = useCallback((payload: TrackerPayload) => {
    setData(payload);
    setClockOffset(new Date(payload.serverTime).getTime() - Date.now());
    setActivity(prev => {
      if (prev && payload.activities.some(a => a.name === prev)) return prev;
      return payload.activeEntry?.activity || payload.activities[0]?.name || '';
    });
  }, []);

  // week = Monday of the week to show; empty means the current week.
  const fetchData = useCallback(async (week?: string) => {
    try {
      const todayKey = istDateKey();
      const r = rangeFor(week || weekStart(todayKey), todayKey);
      const params = new URLSearchParams({ employeeId, from: r.from, to: r.to, t: String(Date.now()) });
      const res = await fetch(`/api/time-tracking?${params}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to load time tracker.');
      applyPayload(payload);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load time tracker.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, rangeFor, applyPayload]);

  // Initial load + polling (keeps the view in sync if another device clocks in/out).
  const weekAnchorRef = useRef(weekAnchor);
  weekAnchorRef.current = weekAnchor;
  useEffect(() => {
    setLoading(true);
    setWeekAnchor('');
    fetchData();
    const poll = setInterval(() => fetchData(weekAnchorRef.current || undefined), POLL_MS);
    const onSync = () => fetchData(weekAnchorRef.current || undefined);
    window.addEventListener('screenshotCaptured', onSync);
    window.addEventListener('timeTrackerChanged', onSync);
    window.addEventListener('focus', onSync);
    return () => {
      clearInterval(poll);
      window.removeEventListener('screenshotCaptured', onSync);
      window.removeEventListener('timeTrackerChanged', onSync);
      window.removeEventListener('focus', onSync);
    };
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now() + clockOffset), 1000);
    setNowMs(Date.now() + clockOffset);
    return () => clearInterval(tick);
  }, [clockOffset]);

  // Idle detection: if the tab sees no interaction for 30 min while working, ask the user.
  const status: TrackerStatus = data?.status || 'OFF';
  useEffect(() => {
    if (compact || status !== 'WORKING' || !data?.canEdit) return;
    const mark = () => { lastInteraction.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, mark, { passive: true }));
    mark();
    const check = setInterval(() => {
      if (Date.now() - lastInteraction.current > IDLE_PROMPT_MS) setIdlePrompt(true);
    }, 60000);
    return () => {
      events.forEach(ev => window.removeEventListener(ev, mark));
      clearInterval(check);
    };
  }, [status, compact, data?.canEdit]);

  // Screenshots follow the tracker: capture only while WORKING, stop on clock-out or when HR turns them off.
  const shotsEnabled = Boolean(data?.enabled && data.screenshots?.enabled);
  const shotMin = data?.screenshots?.intervalMinMinutes || 5;
  const shotMax = data?.screenshots?.intervalMaxMinutes || 7;
  useEffect(() => {
    const mgr = getScreenCapture();
    if (!mgr || !data?.canEdit) return;
    if (busy) return; // Do not interrupt an active clock-in/out or break transition
    if (!shotsEnabled) {
      if (mgr.snapshot.sharing || mgr.snapshot.running) mgr.stop();
      return;
    }
    if (status === 'OFF') {
      if (mgr.snapshot.sharing || mgr.snapshot.running) mgr.stop();
      return;
    }
    mgr.setRunning(status === 'WORKING', employeeId, shotMin, shotMax, {
      employeeName: data.employee.name,
      activity: data.activeEntry?.activity || activity,
    });
  }, [data?.canEdit, data?.employee.name, data?.activeEntry?.activity, activity, shotsEnabled, shotMin, shotMax, status, employeeId, busy]);

  // Reloading or closing the page ends screen sharing, so warn while it is active.
  const sharingLive = Boolean(capture?.sharing && status !== 'OFF');
  useEffect(() => {
    if (!sharingLive) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sharingLive]);

  // Another tab/window of this employee may be the one sharing the screen.
  const serverLastShot = data?.screenshots?.lastAt ? new Date(data.screenshots.lastAt).getTime() : 0;
  const serverCapturing = !capture?.sharing && serverLastShot > 0 && Date.now() - serverLastShot < (shotMax * 2 + 1) * 60000;

  const startSharing = async () => {
    const mgr = getScreenCapture();
    if (!mgr) return;
    setError('');
    const ok = await mgr.requestScreen(employeeId, data?.employee.name, activity);
    if (!ok) {
      setError(mgr.snapshot.error || 'Company policy requires sharing your Entire Screen.');
    } else if (status === 'WORKING') {
      mgr.setRunning(true, employeeId, shotMin, shotMax, {
        employeeName: data?.employee.name,
        activity: data?.activeEntry?.activity || activity,
      });
    }
  };

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!data) return;
    const mgr = getScreenCapture();
    const hasStream = mgr?.hasLiveStream();
    // Ask for the screen inside the click ONLY on initial CLOCK_IN if no live stream exists.
    // Resuming from break (BREAK_END) re-uses the active stream and NEVER prompts!
    const needsScreen = Boolean(mgr && data.canEdit && data.screenshots?.enabled && action === 'CLOCK_IN' && !hasStream);
    const sharePromise = needsScreen ? mgr!.requestScreen(employeeId, data.employee.name, (extra.activity as string) || activity) : null;
    setBusy(true);
    setError('');
    setFlash('');

    // Snapshot previous data for rollback on failure
    const prevData = data;

    // Instant optimistic update (0ms delay)
    if (action === 'CLOCK_OUT') {
      mgr?.stop(); // Immediately release screen sharing
      const nowIso = new Date().toISOString();
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'OFF' as TrackerStatus,
          activeEntry: null,
          entries: prev.entries.map(e => (!e.clockOut ? { ...e, clockOut: nowIso } : e)),
        };
      });
      window.dispatchEvent(new CustomEvent('timeTrackerChanged'));
    } else if (action === 'BREAK_START') {
      const nowIso = new Date().toISOString();
      const bType = String(extra.breakType || 'tea');
      const bName = String(extra.breakName || 'Break');
      setData(prev => {
        if (!prev || !prev.activeEntry) return prev;
        const breaks = [...(prev.activeEntry.breaks || []), { type: bType, name: bName, start: nowIso }];
        return {
          ...prev,
          status: 'ON_BREAK' as TrackerStatus,
          activeEntry: { ...prev.activeEntry, breaks },
        };
      });
      window.dispatchEvent(new CustomEvent('timeTrackerChanged'));
    } else if (action === 'BREAK_END') {
      const nowIso = new Date().toISOString();
      setData(prev => {
        if (!prev || !prev.activeEntry) return prev;
        const breaks = [...(prev.activeEntry.breaks || [])];
        if (breaks.length > 0 && !breaks[breaks.length - 1].end) {
          breaks[breaks.length - 1] = { ...breaks[breaks.length - 1], end: nowIso };
        }
        return {
          ...prev,
          status: 'WORKING' as TrackerStatus,
          activeEntry: { ...prev.activeEntry, breaks },
        };
      });
      window.dispatchEvent(new CustomEvent('timeTrackerChanged'));
    }

    try {
      if (sharePromise) {
        const ok = await sharePromise;
        if (!ok) {
          const errMsg = mgr?.snapshot.error || 'Company policy requires sharing your Entire Screen to clock in.';
          setError(errMsg);
          setBusy(false);
          return;
        }
      }

      // Instant optimistic update for CLOCK_IN (0ms delay)
      if (action === 'CLOCK_IN') {
        const nowIso = new Date().toISOString();
        const chosenActivity = (extra.activity as string) || activity || data.activities[0]?.name || 'General';
        setData(prev => {
          if (!prev) return prev;
          const newEntry: TimeEntry = {
            id: `opt-${Date.now()}`,
            employeeId: prev.employee.id,
            date: istDateKey(),
            activity: chosenActivity,
            clockIn: nowIso,
            breaks: [],
            source: 'WEB',
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          return {
            ...prev,
            status: 'WORKING' as TrackerStatus,
            activeEntry: newEntry,
            entries: [newEntry, ...prev.entries],
          };
        });
        window.dispatchEvent(new CustomEvent('timeTrackerChanged'));
      }

      const r = rangeFor(viewWeek, data.today);
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, employeeId, from: r.from, to: r.to, ...extra }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Action failed.');
      applyPayload(payload);
      if (action === 'CLOCK_OUT' || (action === 'SET_TRACKING' && !extra.enabled)) mgr?.stop();
      const messages: Record<string, string> = {
        CLOCK_IN: 'Clocked in. Have a productive day! 🚀',
        BREAK_START: `${(extra.breakName as string) || 'Break'} started. Enjoy! ☕`,
        BREAK_END: 'Welcome back — timer resumed.',
        SWITCH_ACTIVITY: `Now tracking "${extra.activity}".`,
        CLOCK_OUT: 'Clocked out. Great work today! 👋',
        SET_TRACKING: extra.enabled ? 'Time Tracker is on — clock in whenever you start working.' : 'Time Tracker turned off.',
      };
      setFlash(messages[action] || 'Saved.');
      if (action === 'CLOCK_IN' || action === 'CLOCK_OUT') setNote('');
      window.dispatchEvent(new CustomEvent('timeTrackerChanged'));
    } catch (err: any) {
      if (prevData) setData(prevData);
      setError(err.message || 'Action failed.');
      if (action === 'CLOCK_IN' && sharePromise) mgr?.stop();
      fetchData(weekAnchor || undefined);
    } finally {
      setBusy(false);
      setIdlePrompt(false);
    }
  };

  const goToWeek = (week: string) => {
    setWeekAnchor(week === currentWeek ? '' : week);
    fetchData(week);
  };

  if (loading && !data) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center space-x-2">
        <Timer className="w-4 h-4 animate-spin text-purple-400" />
        <span>Loading time tracker…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error || 'Time tracker unavailable.'}</span>
      </div>
    );
  }

  if (!data.enabled) {
    return (
      <div className={`tt-root rounded-2xl bg-slate-900 border border-purple-500/30 shadow-xl ${compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8'}`}>
        <div className={`flex ${compact ? 'flex-col sm:flex-row sm:items-center' : 'flex-col items-center text-center'} justify-between gap-4`}>
          <div className={`flex ${compact ? 'items-center space-x-3.5' : 'flex-col items-center space-y-3'}`}>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-300 flex items-center justify-center shrink-0">
              <Home className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-extrabold text-white">Time Tracker <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider ml-1">Optional</span></p>
              <p className="text-xs text-slate-400 max-w-md">
                Turn it on to clock in, take breaks and keep a timesheet of your hours (office or work from home) — you can turn it off any time.
                {data.screenshots?.enabled && ` While you are clocked in, periodic screenshots of your screen are taken automatically (your browser will ask you to share your screen).`}
              </p>
            </div>
          </div>
          {data.canEdit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction('SET_TRACKING', { enabled: true })}
              className="shrink-0 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <Timer className="w-4 h-4" />
              <span>{busy ? 'Turning on…' : 'Turn on Time Tracker'}</span>
            </button>
          ) : (
            <p className="text-[11px] text-slate-500">{data.employee.name} has not turned on the tracker.</p>
          )}
        </div>
        {error && <p className="mt-3 text-xs text-rose-300 font-semibold">{error}</p>}
      </div>
    );
  }

  const entries = data.entries;
  const active = data.activeEntry;
  const targetMs = (data.employee.dailyWorkingRequirementMinutes || 480) * 60000;
  const todaySummary = summarizeDay(entries, data.today, nowMs);
  const sessionWorkMs = active ? entryWorkMs(active, nowMs) : 0;
  const runningBreak = active?.breaks[active.breaks.length - 1];
  const breakElapsedMs = status === 'ON_BREAK' && runningBreak ? nowMs - new Date(runningBreak.start).getTime() : 0;
  const progress = Math.min(100, Math.round((todaySummary.workMs / targetMs) * 100));

  // Breaks configuration (editable by Master Admin in Settings)
  const breaksConfig: BreakConfig[] = (data.breaksConfig && data.breaksConfig.length > 0)
    ? data.breaksConfig
    : DEFAULT_BREAK_CONFIGS;
  const activeBreaks = breaksConfig.filter(b => b.isActive !== false);

  const runningBreakType = runningBreak?.type || 'tea';
  const runningBreakName = runningBreak?.name || (runningBreakType === 'lunch' ? 'Lunch Break' : 'Tea Break');
  const configuredBreak = breaksConfig.find(b => b.id === runningBreakType || b.name.toLowerCase() === runningBreakName.toLowerCase());
  const allowedBreakDurationMinutes = configuredBreak?.durationMinutes || (runningBreakType === 'lunch' ? 45 : 15);
  const allowedBreakMs = allowedBreakDurationMinutes * 60000;
  const breakOverdueMs = Math.max(0, breakElapsedMs - allowedBreakMs);

  // Extra hours (overtime) strictly minus all break time:
  // todaySummary.workMs is already (totalElapsed - totalBreakMs)
  const { extraMs: extraTodayMs, shortMs: shortTodayMs } = computeExtraHours(todaySummary.workMs, targetMs);

  const statusStyles: Record<TrackerStatus, { label: string; pill: string; dot: string }> = {
    WORKING: { label: 'Working', pill: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400 animate-pulse' },
    ON_BREAK: { label: 'On Break', pill: 'bg-amber-500/10 text-amber-300 border-amber-500/30', dot: 'bg-amber-400 animate-pulse' },
    OFF: { label: 'Clocked Out', pill: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-500' },
  };
  const st = statusStyles[status];

  const controls = data.canEdit ? (
    <div className="flex flex-col gap-2.5 w-full lg:w-auto lg:min-w-[320px]">
      {status === 'OFF' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={activity}
              onChange={e => setActivity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
              aria-label="Activity"
            >
              {data.activities.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What are you working on? (optional)"
              maxLength={300}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          {shotsEnabled && (
            <p className="text-[11px] text-purple-300/90 flex items-center space-x-1.5 font-medium px-1">
              <MonitorUp className="w-3.5 h-3.5 shrink-0 text-purple-400" />
              <span>When prompted, select <strong>Entire Screen</strong> (WFH policy)</span>
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction('CLOCK_IN', { activity, note })}
            className="w-full px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-extrabold shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <Play className="w-5 h-5" />
            <span>{busy ? 'Clocking in…' : 'Clock In'}</span>
          </button>
        </>
      )}

      {status === 'WORKING' && (
        <div className="space-y-2">
          {/* Exactly two breaks: Tea & Lunch (durations set by Master Admin) */}
          <div className={`grid ${activeBreaks.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            {activeBreaks.map(b => {
              const isLunch = b.id === 'lunch' || b.name.toLowerCase().includes('lunch');
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={busy}
                  onClick={() => runAction('BREAK_START', { breakType: b.id, breakName: b.name })}
                  className="px-3 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-200 text-xs font-extrabold flex items-center justify-center space-x-1.5 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  title={`${b.name} (${b.durationMinutes} min limit)`}
                >
                  {isLunch ? <Utensils className="w-3.5 h-3.5 text-amber-300 shrink-0" /> : <Coffee className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                  <span className="truncate">{b.name} ({b.durationMinutes}m)</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => runAction('CLOCK_OUT', { note })}
            className="w-full px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <Square className="w-4 h-4" />
            <span>Clock Out</span>
          </button>
          {!compact && (
            <div className="flex gap-2 pt-0.5">
              <select
                value={activity}
                onChange={e => setActivity(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                aria-label="Switch activity"
              >
                {data.activities.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <button
                type="button"
                disabled={busy || activity === active?.activity}
                onClick={() => runAction('SWITCH_ACTIVITY', { activity })}
                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-purple-500 text-xs font-bold text-slate-200 flex items-center space-x-1.5 transition disabled:opacity-40 cursor-pointer"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>Switch</span>
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'ON_BREAK' && (
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              {runningBreakName.toLowerCase().includes('lunch') ? (
                <Utensils className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Coffee className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-extrabold text-white truncate">{runningBreakName}</p>
                <p className="text-[10px] text-amber-300/80">Allowed limit: {allowedBreakDurationMinutes}m</p>
              </div>
            </div>
            <span className="font-mono text-sm font-black tabular-nums">{formatClock(breakElapsedMs)}</span>
          </div>

          {breakOverdueMs > 0 && (
            <div className="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-300 flex items-center justify-between">
              <span>⚠️ Break limit exceeded</span>
              <span className="font-mono">+{formatDuration(breakOverdueMs)} extra</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction('BREAK_END')}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Resume Work</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction('CLOCK_OUT', { note })}
              className="px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>Clock Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300 font-semibold flex items-center space-x-2">
      <Eye className="w-4 h-4 shrink-0" />
      <span>View only — only {data.employee.name} can clock in/out from their own login.</span>
    </div>
  );

  const heroCard = (
    <div className="tt-root p-5 sm:p-6 rounded-2xl bg-slate-900 border border-purple-500/30 shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center space-x-4 min-w-0">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
            status === 'WORKING' ? 'bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-500/30'
              : status === 'ON_BREAK' ? 'bg-amber-500/15 text-amber-300 ring-2 ring-amber-500/30'
              : 'bg-slate-800 text-slate-400'
          }`}>
            {status === 'ON_BREAK' ? (
              runningBreakName.toLowerCase().includes('lunch') ? <Utensils className="w-7 h-7" /> : <Coffee className="w-7 h-7" />
            ) : (
              <Timer className={`w-7 h-7 ${status === 'WORKING' ? 'animate-pulse' : ''}`} />
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${st.pill}`}>
                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                <span>{st.label}</span>
              </span>
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Time Tracker</span>
            </div>
            <p className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight tabular-nums">
              {formatClock(todaySummary.workMs)}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {status === 'WORKING' && active && (
                <>
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: activityColor(data.activities, active.activity) }} />
                  <strong className="text-slate-200">{active.activity}</strong> · since {formatIstTime(active.clockIn)} · session {formatDuration(sessionWorkMs)}
                </>
              )}
              {status === 'ON_BREAK' && (
                <>On <strong className="text-amber-200">{runningBreakName}</strong> for <strong className="text-amber-300 font-mono">{formatClock(breakElapsedMs)}</strong> — timer paused</>
              )}
              {status === 'OFF' && (todaySummary.sessions > 0 ? `Worked today · last clock-out ${formatIstTime(todaySummary.lastOut)}` : 'You have not clocked in today.')}
            </p>
          </div>
        </div>
        {controls}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span className="text-slate-400">Daily target {formatDuration(targetMs)}</span>
          <span className={progress >= 100 ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
            {progress}%{progress >= 100 ? ' ✓ target met' : ''}
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
          <span className="text-slate-400">
            Total Breaks: <strong className="text-amber-300 font-mono">{formatDuration(todaySummary.breakMs)}</strong>
          </span>
          {extraTodayMs > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
              +{formatDuration(extraTodayMs)} Overtime (Breaks Deducted)
            </span>
          ) : (
            <span className="text-slate-400">
              Remaining: <span className="font-mono text-slate-300">{formatDuration(shortTodayMs)}</span>
            </span>
          )}
        </div>
      </div>

      {(flash || error) && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 border ${error ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{error || flash}</span>
        </div>
      )}

      {shotsEnabled && (
        data.canEdit && status === 'WORKING' && !capture?.sharing && !serverCapturing ? (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="flex items-start space-x-2 text-xs font-semibold text-amber-300">
              <Camera className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{capture?.error || 'Screenshots are paused — screen sharing is off. HR will see that no screenshots are arriving.'}</span>
            </span>
            <button type="button" onClick={startSharing} className="shrink-0 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center justify-center space-x-1.5 cursor-pointer">
              <MonitorUp className="w-3.5 h-3.5" />
              <span>Share screen</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center space-x-1.5 font-bold text-purple-300">
              <Camera className="w-3.5 h-3.5" />
              <span>Screenshots active</span>
            </span>
            {status === 'OFF' && <span>· start automatically when you clock in</span>}
            {status === 'ON_BREAK' && <span>· paused during break</span>}
            {status === 'WORKING' && <span>· monitoring active</span>}
            <span>· {data.screenshots.todayCount} today</span>
            {capture?.sharing && capture.error && <span className="text-amber-300 font-semibold">· {capture.error}</span>}
          </div>
        )
      )}

      {compact && (
        <Link href="/employee?tab=time-tracker" className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-300 hover:text-purple-200 transition">
          <span>Open full timesheet</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );

  if (compact) return heroCard;

  // ---- Today's timeline ----
  const todayEntries = entries.filter(e => e.date === data.today);
  const dayStartHour = Math.min(8, ...todayEntries.map(e => Number(formatIstHour(e.clockIn))));
  const dayEndHour = Math.max(20, ...todayEntries.map(e => Math.ceil(Number(formatIstHour(e.clockOut || new Date(nowMs).toISOString(), true)))));
  const dayStartMs = new Date(`${data.today}T${String(dayStartHour).padStart(2, '0')}:00:00+05:30`).getTime();
  const dayEndMs = new Date(`${data.today}T00:00:00+05:30`).getTime() + Math.min(24, dayEndHour) * 3600000;
  const span = Math.max(1, dayEndMs - dayStartMs);
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - dayStartMs) / span) * 100));

  // ---- Weekly timesheet ----
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(viewWeek, i));
  const weekRange = summarizeRange(entries, weekDays, targetMs, nowMs);
  const weekSummaries = weekRange.perDay;
  const weekTotalMs = weekRange.workMs;
  const weekBreakMs = weekRange.breakMs;
  const daysWorked = weekRange.daysWorked;
  const maxDayMs = Math.max(targetMs, ...weekSummaries.map(d => d.workMs));
  const weekActivity: Record<string, number> = {};
  weekSummaries.forEach(d => Object.entries(d.activityMs).forEach(([k, v]) => { weekActivity[k] = (weekActivity[k] || 0) + v; }));
  const activityRows = Object.entries(weekActivity).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const oldestWeek = addDays(currentWeek, -7 * MAX_WEEKS_BACK);

  return (
    <div className="tt-root space-y-6">
      {heroCard}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Worked Today', value: formatDuration(todaySummary.workMs), sub: `Net hours (breaks deducted)`, color: 'text-emerald-300' },
          { label: 'Break Today', value: formatDuration(todaySummary.breakMs), sub: `${todayEntries.reduce((n, e) => n + e.breaks.length, 0)} break(s) taken`, color: 'text-amber-300' },
          { label: 'Extra Hours / OT', value: extraTodayMs > 0 ? `+${formatDuration(extraTodayMs)}` : '0m', sub: extraTodayMs > 0 ? 'Excludes all breaks ✓' : `${formatDuration(shortTodayMs)} to target`, color: extraTodayMs > 0 ? 'text-emerald-400' : 'text-slate-400' },
          { label: 'This Week', value: formatDuration(weekTotalMs), sub: `${daysWorked} day(s) worked${weekRange.overtimeMs > 0 ? ` · +${formatDuration(weekRange.overtimeMs)} OT` : ''}`, color: 'text-purple-300' },
        ].map(card => (
          <div key={card.label} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-1">
            <p className="text-[11px] font-bold text-slate-400">{card.label}</p>
            <p className={`text-xl sm:text-2xl font-extrabold font-heading ${card.color}`}>{card.value}</p>
            <p className="text-[10px] text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Today's timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white font-heading">Today&apos;s Timeline</h3>
            <p className="text-xs text-slate-400">{dayLabel(data.today)} · every clock-in, break and clock-out</p>
          </div>
          <Clock className="w-5 h-5 text-slate-500" />
        </div>

        <div className="space-y-1.5">
          <div className="relative h-8 rounded-xl bg-slate-800/70 overflow-hidden border border-slate-700/50">
            {todayEntries.map(e => {
              const s = new Date(e.clockIn).getTime();
              const en = e.clockOut ? new Date(e.clockOut).getTime() : nowMs;
              return (
                <React.Fragment key={e.id}>
                  <div
                    className="absolute top-0 bottom-0 opacity-90"
                    style={{ left: `${pct(s)}%`, width: `${Math.max(0.4, pct(en) - pct(s))}%`, background: activityColor(data.activities, e.activity) }}
                    title={`${e.activity}: ${formatIstTime(e.clockIn)} – ${e.clockOut ? formatIstTime(e.clockOut) : 'now'}`}
                  />
                  {e.breaks.map((b, i) => {
                    const bs = new Date(b.start).getTime();
                    const be = b.end ? new Date(b.end).getTime() : nowMs;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(45deg,#334155,#334155_4px,#1e293b_4px,#1e293b_8px)]"
                        style={{ left: `${pct(bs)}%`, width: `${Math.max(0.4, pct(be) - pct(bs))}%` }}
                        title={`Break: ${formatIstTime(b.start)} – ${b.end ? formatIstTime(b.end) : 'now'}`}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
            {nowMs >= dayStartMs && nowMs <= dayEndMs && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-rose-400" style={{ left: `${pct(nowMs)}%` }} title="Now" />
            )}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            {Array.from({ length: 5 }, (_, i) => {
              const ms = dayStartMs + (span * i) / 4;
              return <span key={i}>{formatIstTime(new Date(ms).toISOString())}</span>;
            })}
          </div>
        </div>

        {todayEntries.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No sessions yet today. Clock in to start tracking.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {[...todayEntries].reverse().map(e => (
              <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="w-2.5 h-10 rounded-full shrink-0" style={{ background: activityColor(data.activities, e.activity) }} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {e.activity}
                      {!e.clockOut && <span className="ml-2 text-[10px] font-black text-emerald-300 uppercase">● Live</span>}
                      {e.autoClosed && <span className="ml-2 text-[10px] font-bold text-amber-300">Auto clock-out</span>}
                      {e.source === 'MANUAL' && <span className="ml-2 text-[10px] font-bold text-blue-300">Added by HR</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatIstTime(e.clockIn)} → {e.clockOut ? formatIstTime(e.clockOut) : 'now'}
                      {e.breaks.length > 0 && ` · ${e.breaks.length} break(s), ${formatDuration(entryBreakMs(e, nowMs))}`}
                    </p>
                    {e.note && <p className="text-[11px] text-slate-500 italic truncate">“{e.note}”</p>}
                  </div>
                </div>
                <span className="text-sm font-extrabold text-white font-mono tabular-nums sm:text-right">{formatDuration(entryWorkMs(e, nowMs))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly timesheet */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-white font-heading">Weekly Timesheet</h3>
              <p className="text-xs text-slate-400">{dayLabel(viewWeek)} – {dayLabel(addDays(viewWeek, 6))}</p>
              <p className="text-[10px] text-slate-500">Tracked separately — not added to your attendance sheet. HR reviews these hours at month end.</p>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => goToWeek(addDays(viewWeek, -7))}
                disabled={viewWeek <= oldestWeek}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {viewWeek !== currentWeek && (
                <button type="button" onClick={() => goToWeek(currentWeek)} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer">
                  This week
                </button>
              )}
              <button
                type="button"
                onClick={() => goToWeek(addDays(viewWeek, 7))}
                disabled={viewWeek >= currentWeek}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {weekSummaries.map((d, i) => {
              const isToday = d.date === data.today;
              const isFuture = d.date > data.today;
              const met = d.workMs >= targetMs;
              return (
                <div key={d.date} className={`grid grid-cols-[64px_1fr_auto] sm:grid-cols-[80px_1fr_150px_70px] items-center gap-3 px-3 py-2.5 rounded-xl ${isToday ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-slate-800/40'}`}>
                  <div>
                    <p className={`text-xs font-black ${isToday ? 'text-purple-200' : 'text-slate-200'}`}>{WEEKDAYS[i]}</p>
                    <p className="text-[10px] text-slate-500">{dayLabel(d.date)}</p>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
                    <div className="absolute inset-y-0 border-r border-dashed border-slate-500/70" style={{ left: `${(targetMs / maxDayMs) * 100}%` }} />
                    <div className={`h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`} style={{ width: `${(d.workMs / maxDayMs) * 100}%` }} />
                  </div>
                  <p className="hidden sm:block text-[10px] text-slate-400 font-mono">
                    {d.firstIn ? `${formatIstTime(d.firstIn)} – ${d.lastOut ? formatIstTime(d.lastOut) : 'now'}` : isFuture ? '' : '—'}
                  </p>
                  <p className={`text-xs font-extrabold font-mono text-right tabular-nums ${d.workMs === 0 ? 'text-slate-600' : met ? 'text-emerald-300' : 'text-white'}`}>
                    {d.workMs === 0 ? (isFuture ? '' : '0m') : formatDuration(d.workMs)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400">Breaks this week: <strong className="text-amber-300">{formatDuration(weekBreakMs)}</strong></span>
            <span className="text-slate-400">Total worked: <strong className="text-white text-sm">{formatDuration(weekTotalMs)}</strong></span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-white font-heading">Activity Breakdown</h3>
            <p className="text-xs text-slate-400">Where your time went this week</p>
          </div>
          {activityRows.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No tracked time in this week yet.</p>
          ) : (
            <div className="space-y-3">
              {activityRows.map(([name, ms]) => (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center space-x-2 font-semibold text-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: activityColor(data.activities, name) }} />
                      <span>{name}</span>
                    </span>
                    <span className="font-mono text-slate-300">{formatDuration(ms)} · {Math.round((ms / Math.max(1, weekTotalMs)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(ms / Math.max(1, weekTotalMs)) * 100}%`, background: activityColor(data.activities, name) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ScreenshotGallery
        employeeId={employeeId}
        employeeName={data.canEdit ? undefined : data.employee.name}
        activities={data.activities}
        title={data.canEdit ? 'My Screenshots' : undefined}
      />

      {data.canEdit && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
          {data.mandatory ? (
            <span>🏠 HR has set you to Work From Home, so the tracker is always on for you.</span>
          ) : (
            <>
              <span>The tracker is optional. Back in office? You can turn it off — your past timesheets stay saved.</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const msg = status === 'OFF' ? 'Turn off the Time Tracker?' : 'You are clocked in. Turning off the tracker will clock you out now. Continue?';
                  if (confirm(msg)) runAction('SET_TRACKING', { enabled: false });
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold disabled:opacity-50 cursor-pointer"
              >
                Turn off tracker
              </button>
            </>
          )}
        </div>
      )}

      {idlePrompt && status === 'WORKING' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-300 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Are you still working?</h3>
              <p className="text-xs text-slate-400 mt-1">No activity was detected on this page for 30 minutes. Your timer is still running.</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => { lastInteraction.current = Date.now(); setIdlePrompt(false); }} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                Yes, I&apos;m still working
              </button>
              <button type="button" onClick={() => runAction('BREAK_START')} className="px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer">
                I was on a break — start break now
              </button>
              <button type="button" onClick={() => runAction('CLOCK_OUT')} className="px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer">
                Clock me out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hour (0-24) of an ISO timestamp in IST; with roundUp, partial hours count as the next hour.
function formatIstHour(iso: string, roundUp = false): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const h = Number(parts.find(p => p.type === 'hour')?.value || 0) % 24;
  const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
  return roundUp && m > 0 ? h + 1 : h;
}
