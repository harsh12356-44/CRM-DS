export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  avatarUrl?: string;
  department: string;
  designation?: string;
  dateOfJoining?: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE' | 'UNUSED';
  monthlySalary: number;
  dailyWorkingRequirementMinutes: number;
  weeklyOff: string; // e.g. "Sunday"
  casualAllowance: number;
  plannedAllowance: number;
  sickAllowance: number;
  reportingManager?: string;
  primaryManager?: string;
  secondaryManager?: string;
  manager1?: string;
  managerName?: string;
  employeeType?: string;
  workMode?: 'OFFICE' | 'WFH';
  timeTrackingEnabled?: boolean; // employee opted in to the time tracker (always on for WFH work mode)
  screenshotsEnabled?: boolean; // overrides the company default set by HR
  screenshotIntervalMinutes?: number; // legacy/nominal interval
  screenshotIntervalMinMinutes?: number; // minimum randomized interval minutes (e.g. 5)
  screenshotIntervalMaxMinutes?: number; // maximum randomized interval minutes (e.g. 7)
  branchId?: string; // e.g. 'branch-main' or 'branch-seo'
  branch?: string; // e.g. 'Main Branch' or 'SEO Branch'
}

export interface Department {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  description?: string;
  employeeCount?: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  dailyWorkingRequirementMinutes: number; // 420 for Main Branch (8h shift) or 480 for SEO Branch (9h shift)
  weeklyOff: string; // 'Sunday' or 'Saturday & Sunday'
  address?: string;
  isDefault?: boolean;
  employeeCount?: number;
  createdAt?: string;
}

export const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'branch-main',
    name: 'Main Branch',
    code: 'MAIN',
    dailyWorkingRequirementMinutes: 420, // 8h Shift (7h work + 1h break)
    weeklyOff: 'Sunday', // 1 day off
    address: 'Digital Suncity Head Office',
    isDefault: true,
  },
  {
    id: 'branch-seo',
    name: 'SEO Branch',
    code: 'SEO',
    dailyWorkingRequirementMinutes: 480, // 9h Shift (8h work + 1h break)
    weeklyOff: 'Saturday & Sunday', // 2 days off
    address: 'Digital Suncity SEO & Digital Wing',
    isDefault: false,
  },
];

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveType: 'Casual Leave' | 'Planned Leave' | 'Short Hours' | string;
  startDate: string;
  endDate: string;
  dayType?: 'full' | 'first_half' | 'second_half';
  daysCount: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'MORE_INFO_REQUIRED' | 'SHORT_HOURS' | string;
  managerStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Short Hours' | string;
  hrStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Short Hours' | string;
  isAdjustment?: boolean;
  isShortHours?: boolean;
  note?: string;
  handoverNote?: string;
  emergencyContact?: string;
  createdAt: string;
}

export interface AttendanceLog {
  id: string;
  employeeId: string;
  date: string;
  attendanceCode: 'P' | 'HD' | 'A' | 'PL' | 'UL' | 'WO' | 'WO-I' | 'H' | 'MP' | 'SW';
  checkIn?: string;
  checkOut?: string;
  workedMinutes: number;
  requiredMinutes: number;
  shortMinutes: number;
  extraMinutes: number;
  sundayWorkedMinutes: number;
  isManual?: boolean;
  correctionReason?: string;
  location?: string;
  createdAt?: string;
}

export interface CompanySettings {
  companyName: string;
  companyLogoUrl: string;
  shiftStartTime: string;
  lunchBreakMinutes: number;
  halfDayThresholdMinutes: number;
  loginUrl: string;
  employeePortalUrl: string;
  managerPortalUrl: string;
}


export interface LeaveSummary {
  employeeId: string;
  employeeName: string;
  avatarUrl?: string;
  department: string;
  status: string;
  casualUsed: number;
  plannedUsed: number;
  totalUsed: number;
  remaining: number;
  totalAllowance: number;
  utilizationPercentage: number;
  extraDeduct: number;
  monthDeductionText?: string;
}

export interface PayrollPreview {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  month: number;
  year: number;
  monthlySalary: number;
  requiredHours: number;
  creditedHours: number;
  shortHours: number;
  hourlyRate: number;
  estimatedDeduction: number;
  missingPunches: number;
  status: 'Ready for Payroll' | 'Needs Attendance Review' | 'Finalized';
  hrComment?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  isOptional: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  objectType: string;
  objectId: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface AttendanceImport {
  id: string;
  filename: string;
  uploadedBy: string;
  uploadDate: string;
  totalEmployees: number;
  totalRows: number;
  importedRows: number;
  missingPunches: number;
  status: 'Completed' | 'Pending' | 'Error';
}

export interface NotificationItem {
  id: string;
  employeeId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// WFH time tracking (Jibble-style clock in / break / clock out sessions)
export interface BreakConfig {
  id: string; // 'tea' | 'lunch' | string
  name: string; // 'Tea Break' | 'Lunch Break' | string
  durationMinutes: number; // 15, 45, etc.
  isActive?: boolean;
}

export interface TimeBreak {
  start: string; // ISO timestamp
  end?: string; // ISO timestamp, undefined while the break is running
  type?: string; // 'tea' | 'lunch' | string
  name?: string; // 'Tea Break' | 'Lunch Break' | string
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD (IST) of the clock-in
  activity: string;
  note?: string;
  clockIn: string; // ISO timestamp
  clockOut?: string; // ISO timestamp, undefined while the session is running
  breaks: TimeBreak[];
  source: 'WEB' | 'MANUAL';
  autoClosed?: boolean;
  editedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeActivity {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

export interface TimeTrackingSettings {
  screenshotsEnabledByDefault: boolean;
  defaultScreenshotIntervalMinutes: number;
  defaultScreenshotIntervalMinMinutes?: number; // minimum randomized interval minutes (e.g. 5)
  defaultScreenshotIntervalMaxMinutes?: number; // maximum randomized interval minutes (e.g. 7)
  screenshotRetentionDays: number;
  retentionPolicyVersion?: number;
  breaks?: BreakConfig[];
  defaultDailyWorkingRequirementMinutes?: number; // 480 for 9h shift (8h work + 1h break) or 420 for 8h shift (7h work + 1h break)
}

// One captured screen image (files live on disk; this is the gallery index row)
export interface ScreenshotMeta {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD (IST)
  takenAt: string; // ISO timestamp
  entryId?: string; // the TimeEntry (working session) this capture belongs to
  sessionClockIn?: string; // clock-in time of that session
  employeeName?: string;
  employeeCode?: string;
  activity?: string;
  width: number;
  height: number;
  size: number;
  surface?: string; // monitor / window / browser, as reported by the browser
}

// Employee Feedback, Complaint, Suggestion, and Support Requests
export type FeedbackCategory = 'Complaint' | 'Feedback' | 'Support' | 'Suggestion';
export type FeedbackStatus = 'Pending' | 'In Review' | 'Resolved';

export interface FeedbackItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  department?: string;
  category: FeedbackCategory;
  subject?: string;
  description: string;
  imageUrl?: string;
  imageName?: string;
  status: FeedbackStatus;
  adminResponse?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export function getLeaveTimestamp(l: Partial<LeaveRecord> | undefined | null): number {
  if (!l) return 0;
  
  if (l.createdAt) {
    const t = new Date(l.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  if (l.id && typeof l.id === 'string') {
    const match = l.id.match(/\d{10,13}/);
    if (match) {
      const num = Number(match[0]);
      if (!isNaN(num) && num > 1000000000) return num;
    }
  }

  if (l.startDate) {
    const t = new Date(l.startDate).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  return 0;
}

export function mergeLeavesNonRegressive(primaryList: LeaveRecord[] = [], secondaryList: LeaveRecord[] = []): LeaveRecord[] {
  const map = new Map<string, LeaveRecord>();

  // Process primary list first
  (primaryList || []).forEach(record => {
    if (!record) return;
    const cleanId = record.id ? String(record.id).trim() : '';
    if (cleanId) {
      map.set(cleanId, { ...record });
    }
  });

  // Process secondary list; only add records if ID does not already exist
  (secondaryList || []).forEach(record => {
    if (!record) return;
    const cleanId = record.id ? String(record.id).trim() : '';
    if (cleanId && !map.has(cleanId)) {
      map.set(cleanId, { ...record });
    }
  });

  return Array.from(map.values()).sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));
}

export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function isDateWeeklyOff(dateStr: string, weeklyOff?: string): boolean {
  if (!dateStr) return false;
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return false;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return false;
    const dayName = WEEK_DAYS[d.getDay()];

    if (!weeklyOff) {
      return dayName === 'Sunday';
    }

    const offDays = weeklyOff
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    return offDays.includes(dayName.toLowerCase());
  } catch (e) {
    return false;
  }
}

export function calculateWorkingDaysCount(startDateStr: string, endDateStr?: string, dayType?: string, weeklyOff?: string): number {
  if (dayType === 'first_half' || dayType === 'second_half') {
    return 0.5;
  }
  if (!startDateStr) return 0;

  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;

  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const targetEnd = new Date(end);
  targetEnd.setHours(0, 0, 0, 0);

  while (current <= targetEnd) {
    const padY = current.getFullYear();
    const padM = String(current.getMonth() + 1).padStart(2, '0');
    const padD = String(current.getDate()).padStart(2, '0');
    const curStr = `${padY}-${padM}-${padD}`;
    if (!isDateWeeklyOff(curStr, weeklyOff)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export function getCurrentQuarter(): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const m = new Date().getMonth() + 1;
  if (m >= 1 && m <= 3) return 'Q1';
  if (m >= 4 && m <= 6) return 'Q2';
  if (m >= 7 && m <= 9) return 'Q3';
  return 'Q4';
}

export function getQuarterFromDateStr(dateStr?: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  if (!dateStr) return getCurrentQuarter();
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return getCurrentQuarter();
    const m = d.getMonth() + 1;
    if (m >= 1 && m <= 3) return 'Q1';
    if (m >= 4 && m <= 6) return 'Q2';
    if (m >= 7 && m <= 9) return 'Q3';
    if (m >= 10 && m <= 12) return 'Q4';
  } catch (e) {}
  return getCurrentQuarter();
}
