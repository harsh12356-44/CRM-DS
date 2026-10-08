export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, ensureCloudSync } from '@/lib/store';
import { ScreenshotMeta } from '@/lib/types';
import { getRequestUser, findRequestEmployee, isSameEmployee, canViewEmployee } from '@/lib/requestUser';
import {
  getEntryStatus,
  getOpenEntry,
  getScreenshotConfig,
  isTimeTrackingEnabled,
  istDateKey,
  resolveTimeTrackingSettings,
} from '@/lib/timeTracking';
import {
  cleanupOldScreenshots,
  deleteScreenshot,
  forgetCapture,
  getLastScreenshotAt,
  isDateKey,
  listScreenshotDates,
  listScreenshots,
  rememberCapture,
  saveScreenshot,
} from '@/lib/screenshotStore';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const MAX_FULL_BYTES = 3 * 1024 * 1024;
const MAX_THUMB_BYTES = 400 * 1024;
const MIN_GAP_MS = 20 * 1000;

function isJpeg(buf: Buffer) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

// GET ?employeeId=&date=  → that day's gallery (+ list of days that have screenshots)
export async function GET(request: Request) {
  try {
    const user = getRequestUser(request);
    if (!user.role) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401, headers: NO_CACHE_HEADERS });
    await ensureCloudSync();
    const url = new URL(request.url);
    const db = getDbData();
    const viewer = findRequestEmployee(user, db.employees);
    const targetId = String(url.searchParams.get('employeeId') || viewer?.id || '').trim();
    const emp = db.employees.find(e => e.id === targetId || e.employeeId === targetId);
    if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
    if (!canViewEmployee(user, viewer, emp)) {
      return NextResponse.json({ error: 'You can only view your own screenshots.' }, { status: 403, headers: NO_CACHE_HEADERS });
    }
    const date = isDateKey(url.searchParams.get('date')) ? url.searchParams.get('date')! : istDateKey();
    // Auto-delete old screenshots even on days nobody uploads (throttled to every 6h).
    cleanupOldScreenshots(resolveTimeTrackingSettings(db.timeTrackingSettings).screenshotRetentionDays, istDateKey());
    return NextResponse.json({
      employeeId: emp.id,
      date,
      screenshots: listScreenshots(emp.id, date),
      dates: listScreenshotDates(emp.id),
      config: getScreenshotConfig(emp, db.timeTrackingSettings),
      canDelete: user.role === 'ADMIN',
    }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load screenshots.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// POST multipart (employeeId, full, thumb, width, height, surface) — the employee's own browser uploads a capture.
export async function POST(request: Request) {
  try {
    const user = getRequestUser(request);
    const form = await request.formData();
    await ensureCloudSync();
    const db = getDbData();
    const targetId = String(form.get('employeeId') || '').trim();
    const emp = db.employees.find(e => e.id === targetId || e.employeeId === targetId);
    if (!emp) return NextResponse.json({ error: 'Employee not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
    if (user.role !== 'ADMIN' && !isSameEmployee(user, emp)) {
      return NextResponse.json({ error: 'Screenshots can only be uploaded from your own login.' }, { status: 403, headers: NO_CACHE_HEADERS });
    }

    const config = getScreenshotConfig(emp, db.timeTrackingSettings);
    if (!isTimeTrackingEnabled(emp) || !config.enabled) {
      return NextResponse.json({ error: 'Screenshots are turned off for you.', stop: false, paused: true, config }, { status: 409, headers: NO_CACHE_HEADERS });
    }
    const open = getOpenEntry(db.timeEntries || [], emp.id, emp.employeeId);
    if (!open || getEntryStatus(open) !== 'WORKING') {
      // Not clocked in or on a break — screenshots paused. DO NOT tell client to kill MediaStream!
      const off = getEntryStatus(open) === 'OFF';
      return NextResponse.json({ error: off ? 'Not clocked in.' : 'On a break — screenshots paused.', stop: false, paused: true, config }, { status: 409, headers: NO_CACHE_HEADERS });
    }

    const nowMs = Date.now();
    const today = istDateKey(nowMs);
    const last = getLastScreenshotAt(emp.id, today);
    if (last && nowMs - new Date(last).getTime() < MIN_GAP_MS) {
      return NextResponse.json({ error: 'Too many screenshots.', config }, { status: 429, headers: NO_CACHE_HEADERS });
    }

    const full = form.get('full');
    const thumb = form.get('thumb');
    if (!(full instanceof Blob) || !(thumb instanceof Blob)) {
      return NextResponse.json({ error: 'Image files are missing.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }
    if (full.size > MAX_FULL_BYTES || thumb.size > MAX_THUMB_BYTES) {
      return NextResponse.json({ error: 'Screenshot is too large.' }, { status: 413, headers: NO_CACHE_HEADERS });
    }
    const fullBuf = Buffer.from(await full.arrayBuffer());
    const thumbBuf = Buffer.from(await thumb.arrayBuffer());
    if (!isJpeg(fullBuf) || !isJpeg(thumbBuf)) {
      return NextResponse.json({ error: 'Screenshots must be JPEG images.' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const takenAt = new Date(nowMs).toISOString();
    const surface = String(form.get('surface') || '').slice(0, 20);
    const meta: ScreenshotMeta = {
      id: `ss-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
      employeeId: emp.id,
      date: today,
      takenAt,
      entryId: open.id,
      sessionClockIn: open.clockIn,
      employeeName: emp.name,
      employeeCode: emp.employeeId,
      activity: open.activity,
      width: Math.max(0, Math.min(10000, Number(form.get('width')) || 0)),
      height: Math.max(0, Math.min(10000, Number(form.get('height')) || 0)),
      size: fullBuf.length,
      surface: /^[a-z-]*$/.test(surface) ? surface || undefined : undefined,
    };
    saveScreenshot(meta, fullBuf, thumbBuf);
    rememberCapture(emp.id, takenAt);
    if (emp.employeeId) rememberCapture(emp.employeeId, takenAt);
    cleanupOldScreenshots(resolveTimeTrackingSettings(db.timeTrackingSettings).screenshotRetentionDays, today);

    return NextResponse.json({ success: true, takenAt, config }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Screenshot upload failed.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

// DELETE ?employeeId=&date=&id=  (HR admins only)
export async function DELETE(request: Request) {
  try {
    const user = getRequestUser(request);
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only HR admins can delete screenshots.' }, { status: 403, headers: NO_CACHE_HEADERS });
    }
    await ensureCloudSync();
    const url = new URL(request.url);
    const employeeId = url.searchParams.get('employeeId') || '';
    const removed = deleteScreenshot(employeeId, url.searchParams.get('date') || '', url.searchParams.get('id') || '');
    if (!removed) return NextResponse.json({ error: 'Screenshot not found.' }, { status: 404, headers: NO_CACHE_HEADERS });
    forgetCapture(employeeId);

    const db = getDbData();
    const actor = findRequestEmployee(user, db.employees);
    db.auditLogs.unshift({
      id: `aud-${Date.now()}`,
      userId: actor?.id || 'unknown',
      userName: actor?.name || 'Admin',
      action: 'Delete Screenshot',
      objectType: 'Screenshot',
      objectId: removed.id,
      oldValue: JSON.stringify({ employeeId: removed.employeeId, takenAt: removed.takenAt }),
      timestamp: new Date().toISOString(),
    });
    await saveDbDataAsync(db);
    return NextResponse.json({ success: true }, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete screenshot.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
