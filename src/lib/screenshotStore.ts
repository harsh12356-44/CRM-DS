import fs from 'fs';
import path from 'path';
import os from 'os';
import { ScreenshotMeta } from './types';

// Screenshot gallery storage: images are plain files, one folder per employee per day,
// with a small index.json per day. Kept out of db.json (which is rewritten on every save).
//
//   <root>/<employeeId>/<YYYY-MM-DD>/index.json
//   <root>/<employeeId>/<YYYY-MM-DD>/<id>.jpg        (full size)
//   <root>/<employeeId>/<YYYY-MM-DD>/<id>_thumb.jpg  (gallery thumbnail)

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

let resolvedRoot: string | null = null;

function root(): string {
  if (resolvedRoot) return resolvedRoot;
  const preferred = process.env.SCREENSHOT_DIR || path.join(process.cwd(), 'data', 'screenshots');
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    resolvedRoot = preferred;
  } catch {
    // Read-only filesystem (e.g. serverless): fall back to the temp dir so capture keeps working.
    resolvedRoot = path.join(os.tmpdir(), 'hrm_screenshots');
    fs.mkdirSync(resolvedRoot, { recursive: true });
  }
  return resolvedRoot;
}

export function isSafeId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 80 && SAFE_SEGMENT.test(v);
}

export function isDateKey(v: unknown): v is string {
  return typeof v === 'string' && DATE_KEY.test(v);
}

function dayDir(employeeId: string, date: string): string {
  if (!isSafeId(employeeId) || !isDateKey(date)) throw new Error('Invalid screenshot path.');
  return path.join(root(), employeeId, date);
}

function readIndex(dir: string): ScreenshotMeta[] {
  try {
    const raw = fs.readFileSync(path.join(dir, 'index.json'), 'utf-8');
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(dir: string, list: ScreenshotMeta[]) {
  const file = path.join(dir, 'index.json');
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list));
  fs.renameSync(tmp, file);
}

export function saveScreenshot(meta: ScreenshotMeta, full: Buffer, thumb: Buffer): void {
  const dir = dayDir(meta.employeeId, meta.date);
  if (!isSafeId(meta.id)) throw new Error('Invalid screenshot id.');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${meta.id}.jpg`), full);
  fs.writeFileSync(path.join(dir, `${meta.id}_thumb.jpg`), thumb);
  const list = readIndex(dir);
  list.push(meta);
  list.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  writeIndex(dir, list);
}

export function listScreenshots(employeeId: string, date: string): ScreenshotMeta[] {
  if (!isSafeId(employeeId) || !isDateKey(date)) return [];
  return readIndex(dayDir(employeeId, date));
}

export function listScreenshotDates(employeeId: string): { date: string; count: number }[] {
  if (!isSafeId(employeeId)) return [];
  const empDir = path.join(root(), employeeId);
  try {
    return fs.readdirSync(empDir)
      .filter(isDateKey)
      .map(date => ({ date, count: readIndex(path.join(empDir, date)).length }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function readScreenshotImage(employeeId: string, date: string, id: string, thumb: boolean): Buffer | null {
  if (!isSafeId(employeeId) || !isDateKey(date) || !isSafeId(id)) return null;
  try {
    return fs.readFileSync(path.join(dayDir(employeeId, date), `${id}${thumb ? '_thumb' : ''}.jpg`));
  } catch {
    return null;
  }
}

export function deleteScreenshot(employeeId: string, date: string, id: string): ScreenshotMeta | null {
  if (!isSafeId(employeeId) || !isDateKey(date) || !isSafeId(id)) return null;
  const dir = dayDir(employeeId, date);
  const list = readIndex(dir);
  const target = list.find(s => s.id === id);
  if (!target) return null;
  for (const name of [`${id}.jpg`, `${id}_thumb.jpg`]) {
    try { fs.unlinkSync(path.join(dir, name)); } catch {}
  }
  writeIndex(dir, list.filter(s => s.id !== id));
  return target;
}

// Last capture time per employee, kept in memory so the live board doesn't scan folders.
const lastCapture = new Map<string, string>();

export function rememberCapture(employeeId: string, takenAt: string) {
  lastCapture.set(employeeId, takenAt);
}

export function getLastScreenshotAt(employeeId: string, today: string): string | undefined {
  const cached = lastCapture.get(employeeId);
  if (cached) return cached;
  const list = listScreenshots(employeeId, today);
  const last = list[list.length - 1]?.takenAt;
  if (last) lastCapture.set(employeeId, last);
  return last;
}

export function forgetCapture(employeeId: string) {
  lastCapture.delete(employeeId);
}

// Retention: permanently deletes every screenshot older than `retentionDays` x 24h —
// both the image files and its row in the day's index.json. Attendance / time entries
// live in db.json and are never touched here.
export interface CleanupResult {
  removedShots: number;
  removedFiles: number;
  removedFolders: number;
  cutoff: string;
}

const CLEANUP_THROTTLE_MS = 60 * 60 * 1000;
let lastCleanup = 0;

export function cleanupOldScreenshots(retentionDays: number = 7, _todayKey?: string, opts: { force?: boolean; nowMs?: number } = {}): CleanupResult {
  const days = Number.isInteger(retentionDays) && retentionDays > 0 ? retentionDays : 7;
  const nowMs = opts.nowMs ?? Date.now();
  const cutoffMs = nowMs - days * 24 * 3600000;
  const result: CleanupResult = { removedShots: 0, removedFiles: 0, removedFolders: 0, cutoff: new Date(cutoffMs).toISOString() };
  if (!opts.force && nowMs - lastCleanup < CLEANUP_THROTTLE_MS) return result;
  lastCleanup = nowMs;
  // A day folder only holds captures from that IST day, so folders dated before the cutoff's IST day are fully expired.
  const cutoffDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(cutoffMs));

  const removeFile = (file: string) => {
    try { fs.unlinkSync(file); result.removedFiles++; } catch {}
  };

  try {
    const base = root();
    for (const emp of fs.readdirSync(base)) {
      const empDir = path.join(base, emp);
      if (!isSafeId(emp) || !fs.statSync(empDir).isDirectory()) continue;
      for (const day of fs.readdirSync(empDir)) {
        const dir = path.join(empDir, day);
        if (!isDateKey(day) || !fs.statSync(dir).isDirectory()) continue;
        if (day < cutoffDay) {
          const shots = readIndex(dir).length;
          const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
          fs.rmSync(dir, { recursive: true, force: true });
          result.removedShots += shots;
          result.removedFiles += files;
          result.removedFolders++;
          continue;
        }
        if (day > cutoffDay) continue;
        // Boundary day: drop only the individual captures taken before the cutoff instant.
        const list = readIndex(dir);
        const keep = list.filter(sh => new Date(sh.takenAt).getTime() >= cutoffMs);
        if (keep.length !== list.length) {
          list.filter(sh => !keep.includes(sh)).forEach(sh => {
            removeFile(path.join(dir, `${sh.id}.jpg`));
            removeFile(path.join(dir, `${sh.id}_thumb.jpg`));
          });
          result.removedShots += list.length - keep.length;
          if (keep.length === 0) {
            fs.rmSync(dir, { recursive: true, force: true });
            result.removedFolders++;
          } else {
            writeIndex(dir, keep);
          }
        }
      }
      if (fs.readdirSync(empDir).length === 0) fs.rmdirSync(empDir);
    }
    lastCapture.clear();
    if (result.removedShots > 0 || result.removedFolders > 0) {
      console.log(`[screenshots] retention ${days}d: deleted ${result.removedShots} screenshot(s), ${result.removedFiles} file(s), ${result.removedFolders} folder(s) older than ${result.cutoff}`);
    }
  } catch (e) {
    console.warn('[screenshots] cleanup failed:', e);
  }
  return result;
}
