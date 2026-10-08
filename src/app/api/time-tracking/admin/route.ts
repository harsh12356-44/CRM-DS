export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, ensureCloudSync, InitialState } from '@/lib/store';
import { deleteTimeEntryFromPrisma } from '@/lib/dbSync';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};
import { Employee, TimeActivity, TimeBreak, TimeEntry } from '@/lib/types';
import { getRequestUser, findRequestEmployee, isManagerOf } from '@/lib/requestUser';
import { cleanupOldScreenshots, getLastScreenshotAt } from '@/lib/screenshotStore';
import {
  DEFAULT_TIME_ACTIVITIES,
  autoCloseStaleEntries,
  getScreenshotConfig,
  resolveTimeTrackingSettings,
  getEntryStatus,
  getOpenEntry,
  isTimeTrackingEnabled,
  isTrackingMandatory,
  istDateKey,
  istToIso,
  addDays,
} from '@/lib/timeTracking';

const MAX_RANGE_DAYS = 92;
const isDateKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);

function publicEmployee(e: Employee, settings: InitialState['timeTrackingSettings']) {
  return {
    screenshots: getScreenshotConfig(e, settings),
    id: e.id,
    employeeId: e.employeeId,
    name: e.name,
    email: e.email,
    department: e.department,
    designation: e.designation,
    status: e.status,
    workMode: e.workMode || 'OFFICE',
    trackingEnabled: isTimeTrackingEnabled(e),
    trackingMandatory: isTrackingMandatory(e),
    primaryManager: e.primaryManager,
    dailyWorkingRequirementMinutes: e.dailyWorkingRequirementMinutes || 480,
  };
}

function pushAudit(db: InitialState, actor: Employee | undefined, action: string, objectId: string, oldValue?: unknown, newValue?: unknown) {
  db.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: actor?.id || 'unknown',
    userName: actor?.name || 'Admin',
    action,
    objectType: 'TimeEntry',
    objectId,
    oldValue: oldValue === undefined ? undefined : JSON.stringify(oldValue),
    newValue: newValue === undefined ? undefined : JSON.stringify(newValue),
    timestamp: new Date().toISOString(),
  });
}

function notify(db: InitialState, employeeId: string, title: string, message: string) {
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift({
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    employeeId,
    type: 'TIME_TRACKING',
    title,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

// Builds a session from IST wall-clock inputs. Manual breaks are placed in the middle of the session.
function buildManualTimes(date: string, startTime: string, endTime: string, breakMinutes: number) {
  const clockIn = istToIso(date, startTime);
  let clockOutMs = new Date(istToIso(date, endTime)).getTime();
  const clockInMs = new Date(clockIn).getTime();
  if (clockOutMs <= clockInMs) clockOutMs += 24 * 3600000; // ends after midnight
  const durationMs = clockOutMs - clockInMs;
  if (durationMs > 16 * 3600000) throw new Error('A single session cannot be longer than 16 hours.');
  const breakMs = Math.max(0, Math.round(breakMinutes || 0)) * 60000;
  if (breakMs >= durationMs) throw new Error('Break time must be shorter than the session.');
  const breaks: TimeBreak[] = [];
  if (breakMs > 0) {
    const breakStart = clockInMs + Math.floor((durationMs - breakMs) / 2);
    breaks.push({ start: new Date(breakStart).toISOString(), end: new Date(breakStart + breakMs).toISOString() });
  }
  return { clockIn, clockOut: new Date(clockOutMs).toISOString(), breaks };
}

function findOverlap(entries: TimeEntry[], employeeId: string, clockIn: string, clockOut: string, ignoreId?: string) {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  return entries.find(e => {
    if (e.employeeId !== employeeId || e.id === ignoreId) return false;
    const eStart = new Date(e.clockIn).getTime();
    const eEnd = e.clockOut ? new Date(e.clockOut).getTime() : Date.now();
    return start < eEnd && end > eStart;
  });
}

function scopeEmployees(db: InitialState, role: string, viewer: Employee | undefined): Employee[] {
  if (role === 'ADMIN') return db.employees;
  return db.employees.filter(e => isManagerOf(viewer, e));
}

export async function GET(request: Request) {
  try {
    await ensureCloudSync();
    const user = getRequestUser(request);
    if (!user.role) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    }
    const db = getDbData();
    if (!db.timeEntries) db.timeEntries = [];
    const viewer = findRequestEmployee(user, db.employees);
    const isAdmin = user.role === 'ADMIN';
    const scoped = scopeEmployees(db, user.role, viewer);
    if (!isAdmin && scoped.length === 0) {
      return NextResponse.json({ error: 'No team members report to you.' }, { status: 403 });
    }

    if (autoCloseStaleEntries(db.timeEntries, Date.now())) {
      await saveDbDataAsync(db);
    }

    const url = new URL(request.url);
    const today = istDateKey();
    let to = isDateKey(url.searchParams.get('to')) ? url.searchParams.get('to')! : today;
    let from = isDateKey(url.searchParams.get('from')) ? url.searchParams.get('from')! : addDays(to, -6);
    if (from > to) [from, to] = [to, from];
    if (from < addDays(to, -MAX_RANGE_DAYS)) from = addDays(to, -MAX_RANGE_DAYS);

    // Auto-delete screenshots past the retention window (throttled to every 6h).
    cleanupOldScreenshots(resolveTimeTrackingSettings(db.timeTrackingSettings).screenshotRetentionDays, today);

    // Every active employee is listed (the tracker is optional for everyone, not only WFH);
    // those who have not turned it on show up as "Tracker off".
    const visible = scoped.filter(e => (e.status || 'ACTIVE') !== 'INACTIVE');
    const scopedIds = new Set(scoped.map(e => e.id));
    const entries = db.timeEntries.filter(e => scopedIds.has(e.employeeId));

    return NextResponse.json({
      viewer: { role: user.role, name: viewer?.name || '', canManage: isAdmin },
      employees: visible.map(e => publicEmployee(e, db.timeTrackingSettings)),
      live: visible.map(e => {
        const open = getOpenEntry(entries, e.id, e.employeeId);
        return {
          employeeId: e.id,
          status: getEntryStatus(open),
          activeEntry: open || null,
          lastScreenshotAt: getLastScreenshotAt(e.id, today) || null,
        };
      }),
      settings: resolveTimeTrackingSettings(db.timeTrackingSettings),
      entries: entries
        .filter(e => (e.date >= from && e.date <= to) || !e.clockOut)
        .sort((a, b) => a.clockIn.localeCompare(b.clockIn)),
      activities: db.timeActivities || DEFAULT_TIME_ACTIVITIES,
      serverTime: new Date().toISOString(),
      today,
      range: { from, to },
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load time tracking data.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCloudSync();
    const user = getRequestUser(request);
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only HR admins can change time tracking data.' }, { status: 403 });
    }
    const body = await request.json();
    const action = String(body.action || '');
    const db = getDbData();
    if (!db.timeEntries) db.timeEntries = [];
    if (!db.timeActivities) db.timeActivities = DEFAULT_TIME_ACTIVITIES.map(a => ({ ...a }));
    const actor = findRequestEmployee(user, db.employees);
    const nowIso = new Date().toISOString();
    autoCloseStaleEntries(db.timeEntries, Date.now());

    const findEmp = () => db.employees.find(e => e.id === body.employeeId || (e.employeeId && e.employeeId === body.employeeId));
    const activityName = (name: unknown) =>
      db.timeActivities!.find(a => a.name === name)?.name || db.timeActivities![0]?.name || 'Other';
    let message = 'Saved.';

    switch (action) {
      case 'SET_TRACKING': {
        const emp = findEmp();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        const enable = Boolean(body.enabled);
        if (!enable && isTrackingMandatory(emp)) {
          return NextResponse.json({ error: `${emp.name} is in Work From Home mode, so tracking is always on. Change their work mode in Employees Roster first.` }, { status: 409 });
        }
        emp.timeTrackingEnabled = enable;
        if (!enable) {
          const open = getOpenEntry(db.timeEntries, emp.id);
          if (open) {
            if (getEntryStatus(open) === 'ON_BREAK') open.breaks[open.breaks.length - 1].end = nowIso;
            open.clockOut = nowIso;
            open.updatedAt = nowIso;
            open.editedBy = actor?.name || 'Admin';
          }
        }
        pushAudit(db, actor, enable ? 'Enable Time Tracker' : 'Disable Time Tracker', emp.id, !enable, enable);
        notify(db, emp.id, enable ? 'Time tracker turned on' : 'Time tracker turned off',
          enable ? 'HR turned on your Time Tracker. Use it to clock in, take breaks and clock out.' : 'HR turned off your Time Tracker.');
        message = `Time tracker ${enable ? 'ON' : 'OFF'} for ${emp.name}.`;
        break;
      }
      case 'ADD_ENTRY': {
        const emp = findEmp();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
        if (!isDateKey(body.date) || !isTime(body.startTime) || !isTime(body.endTime)) {
          return NextResponse.json({ error: 'Date, start time and end time are required.' }, { status: 400 });
        }
        const times = buildManualTimes(body.date, body.startTime, body.endTime, Number(body.breakMinutes) || 0);
        const clash = findOverlap(db.timeEntries, emp.id, times.clockIn, times.clockOut);
        if (clash) return NextResponse.json({ error: 'This overlaps with another session of the same employee.' }, { status: 409 });
        const entry: TimeEntry = {
          id: `te-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          employeeId: emp.id,
          date: body.date,
          activity: activityName(body.activity),
          note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : undefined,
          ...times,
          source: 'MANUAL',
          editedBy: actor?.name || 'Admin',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        db.timeEntries.push(entry);
        pushAudit(db, actor, 'Add Manual Time Entry', entry.id, undefined, entry);
        notify(db, emp.id, 'Time entry added by HR', `HR added a ${body.startTime}–${body.endTime} session on ${body.date}.`);
        message = 'Manual time entry added.';
        break;
      }
      case 'UPDATE_ENTRY': {
        const entry = db.timeEntries.find(e => e.id === body.id);
        if (!entry) return NextResponse.json({ error: 'Time entry not found.' }, { status: 404 });
        if (!entry.clockOut) return NextResponse.json({ error: 'Clock the employee out before editing a running session.' }, { status: 409 });
        if (!isDateKey(body.date) || !isTime(body.startTime) || !isTime(body.endTime)) {
          return NextResponse.json({ error: 'Date, start time and end time are required.' }, { status: 400 });
        }
        const before = { ...entry, breaks: entry.breaks.map(b => ({ ...b })) };
        const times = buildManualTimes(body.date, body.startTime, body.endTime, Number(body.breakMinutes) || 0);
        const clash = findOverlap(db.timeEntries, entry.employeeId, times.clockIn, times.clockOut, entry.id);
        if (clash) return NextResponse.json({ error: 'This overlaps with another session of the same employee.' }, { status: 409 });
        const keepBreaks = body.keepBreaks === true && entry.date === body.date;
        Object.assign(entry, {
          date: body.date,
          activity: activityName(body.activity),
          note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : undefined,
          clockIn: times.clockIn,
          clockOut: times.clockOut,
          breaks: keepBreaks
            ? entry.breaks.filter(b => b.start >= times.clockIn && (b.end || b.start) <= times.clockOut)
            : times.breaks,
          autoClosed: false,
          editedBy: actor?.name || 'Admin',
          updatedAt: nowIso,
        });
        pushAudit(db, actor, 'Edit Time Entry', entry.id, before, entry);
        notify(db, entry.employeeId, 'Time entry corrected by HR', `Your session on ${entry.date} was updated to ${body.startTime}–${body.endTime}.`);
        message = 'Time entry updated.';
        break;
      }
      case 'DELETE_ENTRY': {
        const idx = db.timeEntries.findIndex(e => e.id === body.id);
        if (idx === -1) return NextResponse.json({ error: 'Time entry not found.' }, { status: 404 });
        const [removed] = db.timeEntries.splice(idx, 1);
        pushAudit(db, actor, 'Delete Time Entry', removed.id, removed, undefined);
        notify(db, removed.employeeId, 'Time entry removed by HR', `A session on ${removed.date} was removed from your timesheet.`);
        await deleteTimeEntryFromPrisma(removed.id);
        message = 'Time entry deleted.';
        break;
      }
      case 'FORCE_CLOCK_OUT': {
        const emp = findEmp();
        if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
        const openEntries = db.timeEntries.filter(e => 
          (e.employeeId === emp.id || (emp.employeeId && e.employeeId === emp.employeeId)) && !e.clockOut
        );
        if (openEntries.length === 0) {
          return NextResponse.json({ error: `${emp.name} is already clocked out.` }, { status: 409, headers: NO_CACHE_HEADERS });
        }
        openEntries.forEach(open => {
          if (getEntryStatus(open) === 'ON_BREAK') open.breaks[open.breaks.length - 1].end = nowIso;
          open.clockOut = nowIso;
          open.updatedAt = nowIso;
          open.editedBy = actor?.name || 'Admin';
          pushAudit(db, actor, 'Force Clock Out', open.id, undefined, open);
        });
        notify(db, emp.id, 'Clocked out by HR', 'HR clocked you out of your running WFH session.');
        message = `${emp.name} has been clocked out.`;
        break;
      }
      case 'ADD_ACTIVITY': {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
        if (!name) return NextResponse.json({ error: 'Activity name is required.' }, { status: 400 });
        if (db.timeActivities.some(a => a.name.toLowerCase() === name.toLowerCase())) {
          return NextResponse.json({ error: 'An activity with this name already exists.' }, { status: 409 });
        }
        const activity: TimeActivity = {
          id: `act-${Date.now()}`,
          name,
          color: typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : '#3b82f6',
          isActive: true,
        };
        db.timeActivities.push(activity);
        message = `Activity "${name}" added.`;
        break;
      }
      case 'TOGGLE_ACTIVITY': {
        const activity = db.timeActivities.find(a => a.id === body.id);
        if (!activity) return NextResponse.json({ error: 'Activity not found.' }, { status: 404 });
        if (activity.isActive && db.timeActivities.filter(a => a.isActive).length === 1) {
          return NextResponse.json({ error: 'At least one activity must stay active.' }, { status: 409 });
        }
        activity.isActive = !activity.isActive;
        message = `Activity "${activity.name}" ${activity.isActive ? 'enabled' : 'hidden'}.`;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
    }

    await saveDbDataAsync(db);
    return NextResponse.json({ success: true, message }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Time tracking update failed.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
