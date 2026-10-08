export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, ensureCloudSync, InitialState } from '@/lib/store';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};
import { Employee, TimeEntry } from '@/lib/types';
import { getRequestUser, findRequestEmployee, isSameEmployee, canViewEmployee, RequestUser } from '@/lib/requestUser';
import { getLastScreenshotAt, listScreenshots } from '@/lib/screenshotStore';
import {
  DEFAULT_TIME_ACTIVITIES,
  autoCloseStaleEntries,
  getScreenshotConfig,
  getEntryStatus,
  getOpenEntry,
  isTimeTrackingEnabled,
  isTrackingMandatory,
  istDateKey,
  addDays,
  resolveTimeTrackingSettings,
  isBreakTypeId,
  breakNameFor,
} from '@/lib/timeTracking';

const MAX_RANGE_DAYS = 62;

function buildPayload(db: InitialState, emp: Employee, user: RequestUser, from: string, to: string) {
  const entries = db.timeEntries || [];
  const activeEntry = getOpenEntry(entries, emp.id, emp.employeeId);
  const resolvedSettings = resolveTimeTrackingSettings(db.timeTrackingSettings);
  return {
    employee: {
      id: emp.id,
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department,
      designation: emp.designation,
      workMode: emp.workMode || 'OFFICE',
      dailyWorkingRequirementMinutes: emp.dailyWorkingRequirementMinutes || 480,
    },
    enabled: isTimeTrackingEnabled(emp),
    mandatory: isTrackingMandatory(emp),
    canEdit: isSameEmployee(user, emp),
    status: getEntryStatus(activeEntry),
    activeEntry: activeEntry || null,
    breaksConfig: resolvedSettings.breaks || [],
    entries: entries
      .filter(e => e.employeeId === emp.id && e.date >= from && e.date <= to)
      .sort((a, b) => a.clockIn.localeCompare(b.clockIn)),
    activities: (db.timeActivities || DEFAULT_TIME_ACTIVITIES).filter(a => a.isActive),
    screenshots: {
      ...getScreenshotConfig(emp, db.timeTrackingSettings),
      lastAt: getLastScreenshotAt(emp.id, istDateKey()) || null,
      todayCount: listScreenshots(emp.id, istDateKey()).length,
    },
    serverTime: new Date().toISOString(),
    today: istDateKey(),
    range: { from, to },
  };
}

function resolveRange(url: URL): { from: string; to: string } {
  const today = istDateKey();
  const isDate = (v: string | null) => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));
  let to = isDate(url.searchParams.get('to')) ? url.searchParams.get('to')! : today;
  let from = isDate(url.searchParams.get('from')) ? url.searchParams.get('from')! : addDays(to, -6);
  if (from > to) [from, to] = [to, from];
  if (from < addDays(to, -MAX_RANGE_DAYS)) from = addDays(to, -MAX_RANGE_DAYS);
  return { from, to };
}

export async function GET(request: Request) {
  try {
    await ensureCloudSync();
    const user = getRequestUser(request);
    if (!user.role) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const db = getDbData();
    if (!db.timeEntries) db.timeEntries = [];
    const viewer = findRequestEmployee(user, db.employees);
    const targetId = url.searchParams.get('employeeId') || viewer?.id || '';
    const emp = db.employees.find(e => e.id === targetId || e.employeeId === targetId);

    if (!emp) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }
    if (!canViewEmployee(user, viewer, emp)) {
      return NextResponse.json({ error: 'You can only view your own time tracking.' }, { status: 403 });
    }

    if (autoCloseStaleEntries(db.timeEntries, Date.now())) {
      await saveDbDataAsync(db);
    }

    const { from, to } = resolveRange(url);
    return NextResponse.json(buildPayload(db, emp, user, from, to), { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load time tracking.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCloudSync();
    const user = getRequestUser(request);
    const body = await request.json();
    const action = String(body.action || '');
    const db = getDbData();
    if (!db.timeEntries) db.timeEntries = [];

    const emp = db.employees.find(e => e.id === body.employeeId || e.employeeId === body.employeeId);
    if (!emp) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }
    if (!isSameEmployee(user, emp)) {
      return NextResponse.json({ error: 'You can only clock in / out for your own account.' }, { status: 403 });
    }
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    autoCloseStaleEntries(db.timeEntries, nowMs);
    const today = istDateKey(nowMs);
    const from = typeof body.from === 'string' && body.from ? body.from : addDays(today, -6);
    const to = typeof body.to === 'string' && body.to ? body.to : today;

    // Opting in / out is the employee's own choice (WFH work mode is always tracked).
    if (action === 'SET_TRACKING') {
      const enable = Boolean(body.enabled);
      if (!enable && isTrackingMandatory(emp)) {
        return NextResponse.json({ error: 'HR has set you to Work From Home, so time tracking stays on.' }, { status: 409 });
      }
      emp.timeTrackingEnabled = enable;
      if (!enable) {
        const running = getOpenEntry(db.timeEntries, emp.id);
        if (running) {
          if (getEntryStatus(running) === 'ON_BREAK') running.breaks[running.breaks.length - 1].end = nowIso;
          running.clockOut = nowIso;
          running.updatedAt = nowIso;
        }
      }
      db.auditLogs.unshift({
        id: `aud-${nowMs}`,
        userId: emp.id,
        userName: emp.name,
        action: enable ? 'Turn On Time Tracker' : 'Turn Off Time Tracker',
        objectType: 'Employee',
        objectId: emp.id,
        timestamp: nowIso,
      });
      await saveDbDataAsync(db);
      return NextResponse.json({ success: true, ...buildPayload(db, emp, user, from, to) });
    }

    if (!isTimeTrackingEnabled(emp)) {
      return NextResponse.json({ error: 'Turn on the time tracker first.' }, { status: 403 });
    }

    const activities = (db.timeActivities || DEFAULT_TIME_ACTIVITIES).filter(a => a.isActive);
    const pickActivity = (name: unknown) => {
      const match = activities.find(a => a.name === name);
      return match ? match.name : activities[0]?.name || 'Other';
    };
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : '';

    const open = getOpenEntry(db.timeEntries, emp.id);
    const status = getEntryStatus(open);

    const newEntry = (activity: string): TimeEntry => ({
      id: `te-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      employeeId: emp.id,
      date: istDateKey(nowMs),
      activity,
      note: note || undefined,
      clockIn: nowIso,
      breaks: [],
      source: 'WEB',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    switch (action) {
      case 'CLOCK_IN': {
        if (open) {
          return NextResponse.json({ error: 'You are already clocked in.' }, { status: 409 });
        }
        db.timeEntries.push(newEntry(pickActivity(body.activity)));
        break;
      }
      case 'BREAK_START': {
        if (!open || status !== 'WORKING') {
          return NextResponse.json({ error: 'You need to be working to start a break.' }, { status: 409 });
        }
        const breakType = body.breakType === undefined ? 'tea' : body.breakType;
        if (!isBreakTypeId(breakType)) {
          return NextResponse.json({ error: 'Choose Tea Break or Lunch Break.' }, { status: 400 });
        }
        open.breaks.push({
          start: nowIso,
          type: breakType,
          name: breakNameFor(breakType),
        });
        open.updatedAt = nowIso;
        break;
      }
      case 'BREAK_END': {
        if (!open || status !== 'ON_BREAK') {
          return NextResponse.json({ error: 'You are not on a break.' }, { status: 409 });
        }
        open.breaks[open.breaks.length - 1].end = nowIso;
        open.updatedAt = nowIso;
        break;
      }
      case 'SWITCH_ACTIVITY': {
        if (!open) {
          return NextResponse.json({ error: 'Clock in first to switch activity.' }, { status: 409 });
        }
        const activity = pickActivity(body.activity);
        if (activity === open.activity) {
          return NextResponse.json({ error: `You are already tracking "${activity}".` }, { status: 409 });
        }
        if (status === 'ON_BREAK') open.breaks[open.breaks.length - 1].end = nowIso;
        open.clockOut = nowIso;
        open.updatedAt = nowIso;
        db.timeEntries.push(newEntry(activity));
        break;
      }
      case 'UPDATE_NOTE': {
        if (!open) {
          return NextResponse.json({ error: 'No running session to add a note to.' }, { status: 409 });
        }
        open.note = note || undefined;
        open.updatedAt = nowIso;
        break;
      }
      case 'CLOCK_OUT': {
        const openEntries = db.timeEntries.filter(e => (e.employeeId === emp.id || (emp.employeeId && e.employeeId === emp.employeeId)) && !e.clockOut);
        if (openEntries.length === 0) {
          return NextResponse.json({ error: 'You are not clocked in.' }, { status: 409, headers: NO_CACHE_HEADERS });
        }
        openEntries.forEach(open => {
          if (getEntryStatus(open) === 'ON_BREAK') open.breaks[open.breaks.length - 1].end = nowIso;
          if (note) open.note = note;
          open.clockOut = nowIso;
          open.updatedAt = nowIso;
        });
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }

    await saveDbDataAsync(db);
    return NextResponse.json({ success: true, ...buildPayload(db, emp, user, from, to) }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Time tracking action failed.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
