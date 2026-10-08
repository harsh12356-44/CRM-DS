import { BreakConfig, Employee, TimeActivity, TimeEntry, TimeTrackingSettings } from './types';

// Shared (client + server safe) helpers for the WFH time tracker.
// All day boundaries are computed in IST so a 1 AM session never lands on the previous UTC day.

export const TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

// A session left running longer than this is closed automatically (forgotten clock-out).
export const MAX_SESSION_HOURS = 14;

export const DEFAULT_TIME_ACTIVITIES: TimeActivity[] = [
  { id: 'act-development', name: 'Development', color: '#3b82f6', isActive: true },
  { id: 'act-design', name: 'Design', color: '#a855f7', isActive: true },
  { id: 'act-seo', name: 'SEO & Content', color: '#10b981', isActive: true },
  { id: 'act-meeting', name: 'Meeting / Call', color: '#f59e0b', isActive: true },
  { id: 'act-research', name: 'Research & Learning', color: '#06b6d4', isActive: true },
  { id: 'act-admin', name: 'Admin Work', color: '#64748b', isActive: true },
  { id: 'act-other', name: 'Other', color: '#ec4899', isActive: true },
];

export type TrackerStatus = 'OFF' | 'WORKING' | 'ON_BREAK';

// Company policy: exactly two break types. Master Admin edits only their durations.
export const BREAK_TYPE_IDS = ['tea', 'lunch'] as const;
export type BreakTypeId = typeof BREAK_TYPE_IDS[number];

export const DEFAULT_BREAK_CONFIGS: BreakConfig[] = [
  { id: 'tea', name: 'Tea Break', durationMinutes: 15, isActive: true },
  { id: 'lunch', name: 'Lunch Break', durationMinutes: 45, isActive: true },
];

export const BREAK_MINUTES_MIN = 1;
export const BREAK_MINUTES_MAX = 180;
export const RETENTION_DAYS_MIN = 1;
export const RETENTION_DAYS_MAX = 365;
export const DEFAULT_RETENTION_DAYS = 7;
// Bumped when the retention rule changed from 30 to 7 days. Settings saved before that
// (no policy marker) fall back to the 7-day default instead of the old 30-day value.
export const RETENTION_POLICY_VERSION = 2;

export const DEFAULT_TIME_TRACKING_SETTINGS: TimeTrackingSettings = {
  screenshotsEnabledByDefault: true,
  defaultScreenshotIntervalMinutes: 10,
  screenshotRetentionDays: DEFAULT_RETENTION_DAYS,
  retentionPolicyVersion: RETENTION_POLICY_VERSION,
  breaks: DEFAULT_BREAK_CONFIGS,
};

export const SCREENSHOT_INTERVAL_OPTIONS = [1, 2, 3, 5, 10, 15, 30];

export function isValidBreakMinutes(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= BREAK_MINUTES_MIN && v <= BREAK_MINUTES_MAX;
}

export function isValidRetentionDays(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= RETENTION_DAYS_MIN && v <= RETENTION_DAYS_MAX;
}

export function isBreakTypeId(v: unknown): v is BreakTypeId {
  return typeof v === 'string' && (BREAK_TYPE_IDS as readonly string[]).includes(v);
}

// Always returns exactly [Tea, Lunch]; durations come from the saved settings when valid.
export function normalizeBreaks(saved?: BreakConfig[] | null): BreakConfig[] {
  const list = Array.isArray(saved) ? saved : [];
  return DEFAULT_BREAK_CONFIGS.map(def => {
    const match = list.find(b => b && (b.id === def.id || (b.name || '').toLowerCase().includes(def.id)));
    const minutes = Number(match?.durationMinutes);
    return { ...def, durationMinutes: isValidBreakMinutes(minutes) ? minutes : def.durationMinutes };
  });
}

export function breakNameFor(type: string | undefined): string {
  return DEFAULT_BREAK_CONFIGS.find(b => b.id === type)?.name || 'Break';
}

export function resolveTimeTrackingSettings(s?: Partial<TimeTrackingSettings> | null): TimeTrackingSettings {
  const savedRetention = Number(s?.screenshotRetentionDays);
  const retentionCurrent = s?.retentionPolicyVersion === RETENTION_POLICY_VERSION;
  const interval = Number(s?.defaultScreenshotIntervalMinutes);
  return {
    screenshotsEnabledByDefault: s?.screenshotsEnabledByDefault ?? DEFAULT_TIME_TRACKING_SETTINGS.screenshotsEnabledByDefault,
    defaultScreenshotIntervalMinutes: SCREENSHOT_INTERVAL_OPTIONS.includes(interval) ? interval : DEFAULT_TIME_TRACKING_SETTINGS.defaultScreenshotIntervalMinutes,
    screenshotRetentionDays: retentionCurrent && isValidRetentionDays(savedRetention) ? savedRetention : DEFAULT_RETENTION_DAYS,
    retentionPolicyVersion: RETENTION_POLICY_VERSION,
    breaks: normalizeBreaks(s?.breaks),
  };
}

export interface ScreenshotConfig {
  enabled: boolean;
  intervalMinutes: number;
  isCustom: boolean; // employee has an override instead of the company default
}

export function getScreenshotConfig(
  emp: Pick<Employee, 'screenshotsEnabled' | 'screenshotIntervalMinutes'>,
  settings?: Partial<TimeTrackingSettings> | null
): ScreenshotConfig {
  const s = resolveTimeTrackingSettings(settings);
  return {
    enabled: emp.screenshotsEnabled ?? s.screenshotsEnabledByDefault,
    intervalMinutes: emp.screenshotIntervalMinutes || s.defaultScreenshotIntervalMinutes,
    isCustom: emp.screenshotsEnabled !== undefined || Boolean(emp.screenshotIntervalMinutes),
  };
}

// A working employee is "not capturing" when no screenshot arrived within two intervals (+1 min grace).
export function isScreenshotOverdue(lastAt: string | undefined, sessionStart: string, intervalMinutes: number, nowMs: number): boolean {
  const since = Math.max(lastAt ? new Date(lastAt).getTime() : 0, new Date(sessionStart).getTime());
  return nowMs - since > (intervalMinutes * 2 + 1) * 60000;
}

// The tracker is optional: any active employee can switch it on (e.g. on a WFH day).
// Employees whose work mode is WFH are always tracked.
export function isTimeTrackingEnabled(emp?: Pick<Employee, 'workMode' | 'status' | 'timeTrackingEnabled'> | null): boolean {
  if (!emp || (emp.status || 'ACTIVE') !== 'ACTIVE') return false;
  return emp.workMode === 'WFH' || Boolean(emp.timeTrackingEnabled);
}

export function isTrackingMandatory(emp?: Pick<Employee, 'workMode'> | null): boolean {
  return emp?.workMode === 'WFH';
}

export function istDateKey(d: Date | number | string = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Converts an IST wall-clock date + time ("2026-10-05", "09:30") into an ISO timestamp.
export function istToIso(dateKey: string, time: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh || 0, mm || 0) - IST_OFFSET_MINUTES * 60000;
  return new Date(utcMs).toISOString();
}

// End of an IST calendar day (23:59:59.999) as epoch ms.
export function istDayEndMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999) - IST_OFFSET_MINUTES * 60000;
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().split('T')[0];
}

// Monday of the week that contains dateKey.
export function weekStart(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(dateKey, day === 0 ? -6 : 1 - day);
}

export function formatIstTime(iso?: string): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: true });
}

// "07 Oct 2026" and "10:42:05 AM" in IST — used to label screenshots.
export function formatIstDate(iso?: string): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatIstTimeWithSeconds(iso?: string): string {
  if (!iso) return '--:--:--';
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export function isoToIstTimeInput(iso?: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export function entryBreakMs(entry: TimeEntry, nowMs: number): number {
  const endCap = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
  return (entry.breaks || []).reduce((sum, b) => {
    const start = new Date(b.start).getTime();
    const end = b.end ? new Date(b.end).getTime() : endCap;
    return sum + Math.max(0, Math.min(end, endCap) - start);
  }, 0);
}

export function entryWorkMs(entry: TimeEntry, nowMs: number): number {
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
  return Math.max(0, end - start - entryBreakMs(entry, nowMs));
}

export function getOpenEntry(entries: TimeEntry[], employeeId: string, altEmployeeId?: string): TimeEntry | undefined {
  return entries.find(e => (e.employeeId === employeeId || (altEmployeeId && e.employeeId === altEmployeeId)) && !e.clockOut);
}

export function getEntryStatus(entry?: TimeEntry): TrackerStatus {
  if (!entry || entry.clockOut) return 'OFF';
  const lastBreak = entry.breaks?.[entry.breaks.length - 1];
  return lastBreak && !lastBreak.end ? 'ON_BREAK' : 'WORKING';
}

export interface DaySummary {
  date: string;
  workMs: number; // Net worked milliseconds (total elapsed minus all breaks taken)
  breakMs: number; // Total break duration in milliseconds
  sessions: number;
  firstIn?: string;
  lastOut?: string;
  activityMs: Record<string, number>;
  breakTypeMs: Record<string, number>; // Breakdown of break time e.g. "Tea Break": 900000
}

export function entryBreakDurationByType(entry: TimeEntry, nowMs: number): Record<string, number> {
  const endCap = entry.clockOut ? new Date(entry.clockOut).getTime() : nowMs;
  const res: Record<string, number> = {};
  (entry.breaks || []).forEach(b => {
    const start = new Date(b.start).getTime();
    const end = b.end ? new Date(b.end).getTime() : endCap;
    const dur = Math.max(0, Math.min(end, endCap) - start);
    const key = b.name || (b.type === 'tea' ? 'Tea Break' : b.type === 'lunch' ? 'Lunch Break' : 'Break');
    res[key] = (res[key] || 0) + dur;
  });
  return res;
}

// Extra hours (overtime) strictly subtracts break time because workMs = elapsed - breakMs.
export function computeExtraHours(workMs: number, targetMs: number) {
  const extraMs = Math.max(0, workMs - targetMs);
  const shortMs = Math.max(0, targetMs - workMs);
  return { extraMs, shortMs };
}

export interface RangeSummary {
  workMs: number; // logged-in time minus breaks, summed over the range
  breakMs: number;
  loggedMs: number; // clock-in to clock-out, breaks included
  daysWorked: number;
  targetMs: number; // daily requirement x days worked
  overtimeMs: number; // sum of each day's extra hours
  shortMs: number; // sum of each day's shortfall
}

// One formula everywhere (employee view, admin board, timesheet, CSV):
//   worked = logged-in time - break time;  overtime per day = max(0, worked - daily requirement)
export function summarizeRange(entries: TimeEntry[], days: string[], dailyTargetMs: number, nowMs: number): RangeSummary & { perDay: DaySummary[] } {
  const perDay = days.map(d => summarizeDay(entries, d, nowMs));
  const res: RangeSummary = { workMs: 0, breakMs: 0, loggedMs: 0, daysWorked: 0, targetMs: 0, overtimeMs: 0, shortMs: 0 };
  perDay.forEach(d => {
    res.workMs += d.workMs;
    res.breakMs += d.breakMs;
    res.loggedMs += d.workMs + d.breakMs;
    if (d.workMs <= 0) return;
    res.daysWorked++;
    res.targetMs += dailyTargetMs;
    const { extraMs, shortMs } = computeExtraHours(d.workMs, dailyTargetMs);
    res.overtimeMs += extraMs;
    res.shortMs += shortMs;
  });
  return { ...res, perDay };
}

export function summarizeDay(entries: TimeEntry[], date: string, nowMs: number): DaySummary {
  const dayEntries = entries.filter(e => e.date === date).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  const summary: DaySummary = { date, workMs: 0, breakMs: 0, sessions: dayEntries.length, activityMs: {}, breakTypeMs: {} };
  dayEntries.forEach(e => {
    const work = entryWorkMs(e, nowMs);
    summary.workMs += work;
    summary.breakMs += entryBreakMs(e, nowMs);
    summary.activityMs[e.activity] = (summary.activityMs[e.activity] || 0) + work;
    const byType = entryBreakDurationByType(e, nowMs);
    Object.entries(byType).forEach(([k, v]) => {
      summary.breakTypeMs[k] = (summary.breakTypeMs[k] || 0) + v;
    });
  });
  if (dayEntries.length > 0) {
    summary.firstIn = dayEntries[0].clockIn;
    const last = dayEntries[dayEntries.length - 1];
    summary.lastOut = last.clockOut;
  }
  return summary;
}

// Closes sessions (and their running breaks) that were never clocked out:
// either they crossed into a new IST day or ran past MAX_SESSION_HOURS.
// Returns true when anything changed so the caller can persist.
export function autoCloseStaleEntries(entries: TimeEntry[], nowMs: number): boolean {
  const today = istDateKey(nowMs);
  let changed = false;
  entries.forEach(e => {
    if (e.clockOut) return;
    const startMs = new Date(e.clockIn).getTime();
    const maxEnd = startMs + MAX_SESSION_HOURS * 3600000;
    const crossedDay = e.date !== today;
    if (!crossedDay && nowMs < maxEnd) return;

    const lastBreak = e.breaks?.[e.breaks.length - 1];
    // If they were on a break when they forgot, end the work at the break start.
    let closeMs = Math.min(maxEnd, istDayEndMs(e.date), nowMs);
    if (lastBreak && !lastBreak.end) {
      closeMs = Math.min(closeMs, new Date(lastBreak.start).getTime());
      lastBreak.end = new Date(closeMs).toISOString();
    }
    e.clockOut = new Date(Math.max(closeMs, startMs)).toISOString();
    e.autoClosed = true;
    e.updatedAt = new Date(nowMs).toISOString();
    changed = true;
  });
  return changed;
}

export function activityColor(activities: TimeActivity[], name: string): string {
  return activities.find(a => a.name === name)?.color || '#64748b';
}
