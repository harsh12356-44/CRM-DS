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
}

export interface Department {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  description?: string;
  employeeCount?: number;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  leaveType: 'Casual Leave' | 'Planned Leave' | string;
  startDate: string;
  endDate: string;
  dayType?: 'full' | 'first_half' | 'second_half';
  daysCount: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  year: number;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'MORE_INFO_REQUIRED';
  managerStatus?: 'Pending' | 'Approved' | 'Rejected';
  hrStatus?: 'Pending' | 'Approved' | 'Rejected';
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
  const combined = [...(primaryList || []), ...(secondaryList || [])].filter(Boolean);
  const map = new Map<string, LeaveRecord>();

  combined.forEach(record => {
    if (!record) return;

    const cleanId = record.id ? String(record.id).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : '';
    const empRef = String(record.employeeId || (record as any).employeeName || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    const startDate = String(record.startDate || '').trim();

    let matchKey: string | null = null;

    for (const [key, existing] of map.entries()) {
      const exCleanId = existing.id ? String(existing.id).replace(/[^0-9a-zA-Z]/g, '').toLowerCase() : '';
      const exEmpRef = String(existing.employeeId || (existing as any).employeeName || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const exStartDate = String(existing.startDate || '').trim();

      const isExactId = cleanId && exCleanId && cleanId === exCleanId;
      const isIdMatch = cleanId && exCleanId && (cleanId.endsWith(exCleanId) || exCleanId.endsWith(cleanId));
      const isEmpDateMatch = startDate && exStartDate && startDate === exStartDate &&
        (empRef === exEmpRef || (empRef && exEmpRef && (empRef.includes(exEmpRef) || exEmpRef.includes(empRef))));

      if (isExactId || isIdMatch || isEmpDateMatch) {
        matchKey = key;
        break;
      }
    }

    if (!matchKey) {
      const newKey = cleanId || `${empRef}_${startDate}_${record.leaveType}`;
      map.set(newKey, { ...record });
    } else {
      const existing = map.get(matchKey)!;

      const bestManagerStatus =
        existing.managerStatus === 'Approved' || record.managerStatus === 'Approved'
          ? 'Approved'
          : existing.managerStatus === 'Rejected' || record.managerStatus === 'Rejected'
          ? 'Rejected'
          : record.managerStatus || existing.managerStatus || 'Pending';

      const bestHrStatus =
        existing.hrStatus === 'Approved' || record.hrStatus === 'Approved'
          ? 'Approved'
          : existing.hrStatus === 'Rejected' || record.hrStatus === 'Rejected'
          ? 'Rejected'
          : record.hrStatus || existing.hrStatus || 'Pending';

      const isApproved =
        (bestManagerStatus === 'Approved' && bestHrStatus === 'Approved') ||
        existing.status === 'APPROVED' ||
        record.status === 'APPROVED';

      const isRejected =
        existing.status === 'REJECTED' ||
        record.status === 'REJECTED' ||
        bestManagerStatus === 'Rejected' ||
        bestHrStatus === 'Rejected';

      const bestStatus = isApproved ? 'APPROVED' : isRejected ? 'REJECTED' : (record.status || existing.status || 'PENDING');

      map.set(matchKey, {
        ...existing,
        ...record,
        id: existing.id || record.id,
        managerStatus: bestManagerStatus,
        hrStatus: bestHrStatus,
        status: bestStatus,
        note: record.note && record.note !== 'Leave application' ? record.note : existing.note || record.note,
        createdAt: getLeaveTimestamp(record) > getLeaveTimestamp(existing) ? record.createdAt : existing.createdAt,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));
}

export function calculateWorkingDaysCount(startDateStr: string, endDateStr?: string, dayType?: string): number {
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
    // 0 is Sunday (Weekly Off)
    if (current.getDay() !== 0) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
