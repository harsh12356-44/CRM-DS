export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, ensureCloudSync } from '@/lib/store';
import { cleanupOldScreenshots } from '@/lib/screenshotStore';
import { getRequestUser, findRequestEmployee, isManagerOf } from '@/lib/requestUser';
import {
  BREAK_MINUTES_MAX,
  BREAK_MINUTES_MIN,
  RETENTION_DAYS_MAX,
  RETENTION_DAYS_MIN,
  SCREENSHOT_INTERVAL_OPTIONS,
  SCREENSHOT_RANGE_OPTIONS,
  findRangeOption,
  getScreenshotConfig,
  isValidBreakMinutes,
  isValidRetentionDays,
  normalizeBreaks,
  resolveTimeTrackingSettings,
} from '@/lib/timeTracking';

// HR admins (everyone) and managers (their own team) decide screenshot on/off and interval.
export async function POST(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!user.role) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
    const body = await request.json();
    await ensureCloudSync();
    const db = getDbData();
    const actor = findRequestEmployee(user, db.employees);
    const isAdmin = user.role === 'ADMIN';
    const nowIso = new Date().toISOString();
    const audit = (action: string, objectId: string, oldValue: unknown, newValue: unknown) => {
      db.auditLogs.unshift({
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: actor?.id || 'unknown',
        userName: actor?.name || 'Admin',
        action,
        objectType: 'ScreenshotSettings',
        objectId,
        oldValue: JSON.stringify(oldValue),
        newValue: JSON.stringify(newValue),
        timestamp: nowIso,
      });
    };

    if (body.action === 'SET_DEFAULTS') {
      if (!isAdmin) return NextResponse.json({ error: 'Only HR admins can change company defaults.' }, { status: 403 });
      const before = resolveTimeTrackingSettings(db.timeTrackingSettings);
      
      let min = Number(body.defaultScreenshotIntervalMinMinutes);
      let max = Number(body.defaultScreenshotIntervalMaxMinutes);

      if (body.rangeId) {
        const matched = SCREENSHOT_RANGE_OPTIONS.find(r => r.id === body.rangeId);
        if (matched) {
          min = matched.min;
          max = matched.max;
        }
      }

      if (!min || !max || min <= 0 || max < min) {
        min = before.defaultScreenshotIntervalMinMinutes || 5;
        max = before.defaultScreenshotIntervalMaxMinutes || 7;
      }

      const interval = Math.round((min + max) / 2);
      const retention = Number(body.screenshotRetentionDays ?? before.screenshotRetentionDays);
      if (!isValidRetentionDays(retention)) {
        return NextResponse.json({ error: `Screenshot retention must be a whole number from ${RETENTION_DAYS_MIN} to ${RETENTION_DAYS_MAX} days.` }, { status: 400 });
      }
      db.timeTrackingSettings = {
        ...before,
        screenshotsEnabledByDefault: typeof body.screenshotsEnabledByDefault === 'boolean' ? body.screenshotsEnabledByDefault : before.screenshotsEnabledByDefault,
        defaultScreenshotIntervalMinutes: interval,
        defaultScreenshotIntervalMinMinutes: min,
        defaultScreenshotIntervalMaxMinutes: max,
        screenshotRetentionDays: retention,
      };
      audit('Update Screenshot Defaults', 'default', before, db.timeTrackingSettings);
      await saveDbDataAsync(db);
      if (retention !== before.screenshotRetentionDays) cleanupOldScreenshots(retention, undefined, { force: true });
      return NextResponse.json({ success: true, message: 'Company screenshot defaults saved.', settings: db.timeTrackingSettings });
    }

    // Master Admin: Tea / Lunch break durations (the two break types are fixed).
    if (body.action === 'SET_BREAKS') {
      if (!isAdmin) return NextResponse.json({ error: 'Only HR admins can change break settings.' }, { status: 403 });
      const before = resolveTimeTrackingSettings(db.timeTrackingSettings);
      const fromList = (id: string) => Array.isArray(body.breaks) ? body.breaks.find((b: any) => b?.id === id)?.durationMinutes : undefined;
      const tea = Number(body.teaMinutes ?? fromList('tea'));
      const lunch = Number(body.lunchMinutes ?? fromList('lunch'));
      for (const [label, v] of [['Tea Break', tea], ['Lunch Break', lunch]] as [string, number][]) {
        if (!isValidBreakMinutes(v)) {
          return NextResponse.json({ error: `${label} must be a whole number of minutes from ${BREAK_MINUTES_MIN} to ${BREAK_MINUTES_MAX}.` }, { status: 400 });
        }
      }
      const breaks = normalizeBreaks([
        { id: 'tea', name: 'Tea Break', durationMinutes: tea },
        { id: 'lunch', name: 'Lunch Break', durationMinutes: lunch },
      ]);
      db.timeTrackingSettings = { ...before, breaks };
      audit('Update Break Settings', 'breaks', before.breaks, breaks);
      await saveDbDataAsync(db);
      return NextResponse.json({ success: true, message: `Breaks saved: Tea ${tea} min, Lunch ${lunch} min.`, settings: db.timeTrackingSettings });
    }

    if (body.action === 'SET_EMPLOYEE') {
      const emp = db.employees.find(e => e.id === body.employeeId);
      if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
      if (!isAdmin && !isManagerOf(actor, emp)) {
        return NextResponse.json({ error: 'You can only change screenshot settings for your own team.' }, { status: 403 });
      }
      const before = getScreenshotConfig(emp, db.timeTrackingSettings);
      if (body.reset === true) {
        delete emp.screenshotsEnabled;
        delete emp.screenshotIntervalMinutes;
        delete emp.screenshotIntervalMinMinutes;
        delete emp.screenshotIntervalMaxMinutes;
      } else {
        if (typeof body.enabled === 'boolean') emp.screenshotsEnabled = body.enabled;
        if (body.rangeId) {
          const matched = SCREENSHOT_RANGE_OPTIONS.find(r => r.id === body.rangeId);
          if (matched) {
            emp.screenshotIntervalMinMinutes = matched.min;
            emp.screenshotIntervalMaxMinutes = matched.max;
            emp.screenshotIntervalMinutes = Math.round((matched.min + matched.max) / 2);
          }
        } else if (body.intervalMinMinutes !== undefined && body.intervalMaxMinutes !== undefined) {
          const min = Number(body.intervalMinMinutes);
          const max = Number(body.intervalMaxMinutes);
          if (min > 0 && max >= min) {
            emp.screenshotIntervalMinMinutes = min;
            emp.screenshotIntervalMaxMinutes = max;
            emp.screenshotIntervalMinutes = Math.round((min + max) / 2);
          }
        } else if (body.intervalMinutes !== undefined) {
          const interval = Number(body.intervalMinutes);
          emp.screenshotIntervalMinutes = interval;
          emp.screenshotIntervalMinMinutes = Math.max(1, interval - 2);
          emp.screenshotIntervalMaxMinutes = interval + 2;
        }
      }
      const after = getScreenshotConfig(emp, db.timeTrackingSettings);
      audit('Update Employee Screenshot Settings', emp.id, before, after);
      if (before.enabled !== after.enabled || before.intervalMinMinutes !== after.intervalMinMinutes || before.intervalMaxMinutes !== after.intervalMaxMinutes) {
        if (!db.notifications) db.notifications = [];
        db.notifications.unshift({
          id: `notif-${Date.now()}`,
          employeeId: emp.id,
          type: 'TIME_TRACKING',
          title: 'Screenshot settings updated',
          message: after.enabled
            ? 'While you are clocked in, periodic screenshots of your screen will be taken automatically.'
            : 'Screenshots are turned off for your Time Tracker.',
          isRead: false,
          createdAt: nowIso,
        });
      }
      await saveDbDataAsync(db);
      return NextResponse.json({
        success: true,
        message: after.enabled ? `${emp.name}: screenshots randomized (${after.intervalMinMinutes}–${after.intervalMaxMinutes} min).` : `${emp.name}: screenshots off.`,
        config: after,
      });
    }

    return NextResponse.json({ error: `Unknown action "${body.action}".` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save screenshot settings.' }, { status: 500 });
  }
}
