import {
  Employee,
  LeaveRecord,
  AttendanceLog,
  CompanySettings,
  LeaveSummary,
  PayrollPreview,
  Holiday,
  AuditLogEntry,
  AttendanceImport,
  NotificationItem,
} from './types';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TMP_DB_FILE = path.join(os.tmpdir(), 'hrm_db.json');

interface InitialState {
  employees: Employee[];
  leaveRecords: LeaveRecord[];
  attendanceLogs: AttendanceLog[];
  settings: CompanySettings;
  payrollPreviews: PayrollPreview[];
  holidays: Holiday[];
  auditLogs: AuditLogEntry[];
  attendanceImports: AttendanceImport[];
  notifications: NotificationItem[];
  departments?: any[];
  deletedDepartments?: string[];
}

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    employeeId: 'RK001',
    name: 'Ravina Khimani',
    email: 'ravina@hrmpilot.com',
    password: 'Admin@123',
    phone: '+91 98765 00001',
    department: 'Human Resources',
    designation: 'HR / COO',
    dateOfJoining: '2024-01-01',
    role: 'ADMIN',
    status: 'ACTIVE',
    monthlySalary: 95000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-2',
    employeeId: 'NB002',
    name: 'Naman Bangia',
    email: 'naman@hrmpilot.com',
    password: 'Manager@123',
    phone: '+91 98765 00002',
    department: 'Development',
    designation: 'Senior Development Manager',
    dateOfJoining: '2024-01-15',
    role: 'MANAGER',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 85000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-3',
    employeeId: 'JS003',
    name: 'Jigyasa Sen',
    email: 'jigyasa@hrmpilot.com',
    password: 'Manager@123',
    phone: '+91 98765 00003',
    department: 'Development',
    designation: 'Senior Development Manager',
    dateOfJoining: '2024-02-01',
    role: 'MANAGER',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 85000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-4',
    employeeId: 'DV004',
    name: 'Divyanshu',
    email: 'divyanshu@hrmpilot.com',
    password: 'Manager@123',
    phone: '+91 98765 00004',
    department: 'Development',
    designation: 'Senior Development Manager',
    dateOfJoining: '2024-02-15',
    role: 'MANAGER',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 85000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-5',
    employeeId: 'MN005',
    name: 'Meenal',
    email: 'meenal@hrmpilot.com',
    password: 'Manager@123',
    phone: '+91 98765 00005',
    department: 'SEO',
    designation: 'SEO Manager',
    dateOfJoining: '2024-03-01',
    role: 'MANAGER',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 75000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-6',
    employeeId: 'NG006',
    name: 'Nandini Gupta',
    email: 'nandini@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00006',
    department: 'Founders Office',
    designation: 'Founders Office',
    dateOfJoining: '2024-03-15',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 65000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-7',
    employeeId: 'AS007',
    name: 'Anup Sen',
    email: 'anup@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00007',
    department: 'Development',
    designation: 'Web Designer',
    dateOfJoining: '2024-04-01',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Naman Bangia',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 55000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-8',
    employeeId: 'LG008',
    name: 'Lochita g1',
    email: 'lochita.ds@gmail.com',
    password: 'Lochita@123#',
    phone: '+91 98765 00008',
    department: 'Development',
    designation: 'Web Designer',
    dateOfJoining: '2024-04-10',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Naman Bangia',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-9',
    employeeId: 'RV009',
    name: 'Rajvardhan',
    email: 'rajvardhansingh0404@gmail.com',
    password: 'Raj@123#',
    phone: '+91 98765 00009',
    department: 'Development',
    designation: 'Web Designer',
    dateOfJoining: '2024-04-15',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Naman Bangia',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-10',
    employeeId: 'MD010',
    name: 'Mudita',
    email: 'mudita@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00010',
    department: 'Development',
    designation: 'Web Designer',
    dateOfJoining: '2024-05-01',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Naman Bangia',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-11',
    employeeId: 'BB011',
    name: 'Bulbul',
    email: 'bulbulmaheshwari64@gmail.com',
    password: 'Bulbul@#!2#',
    phone: '+91 98765 00011',
    department: 'Development',
    designation: 'Web Designer',
    dateOfJoining: '2024-05-10',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Naman Bangia',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-12',
    employeeId: 'SG012',
    name: 'Sonu Goswami',
    email: 'sonu@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00012',
    department: 'Development',
    designation: 'Web Developer',
    dateOfJoining: '2024-05-15',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Naman Bangia',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-13',
    employeeId: 'SD013',
    name: 'Shweta dadhich',
    email: 'shweta@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00013',
    department: 'Development',
    designation: 'Web Designer',
    dateOfJoining: '2024-06-01',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Jigyasa Sen',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-14',
    employeeId: 'CB014',
    name: 'Charubhati',
    email: 'charubhati@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00014',
    department: 'SEO',
    designation: 'SEO Executive',
    dateOfJoining: '2024-06-10',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Meenal',
    secondaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-15',
    employeeId: 'SY015',
    name: 'Shryanshu',
    email: 'shryanshu@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00015',
    department: 'General',
    designation: 'Final Suspect',
    dateOfJoining: '2024-07-01',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-16',
    employeeId: 'GV016',
    name: 'Garv',
    email: 'garv@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00016',
    department: 'General',
    designation: 'Final Suspect',
    dateOfJoining: '2024-07-05',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-17',
    employeeId: 'CS017',
    name: 'Charu Siddhawat',
    email: 'charu@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00017',
    department: 'General',
    designation: 'Final Suspect',
    dateOfJoining: '2024-07-10',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 0,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
  {
    id: 'emp-18',
    employeeId: 'SP018',
    name: 'Sudeshna Pyne',
    email: 'sudeshna@hrmpilot.com',
    password: 'Employee@123',
    phone: '+91 98765 00018',
    department: 'Design',
    designation: 'Graphic Designer',
    dateOfJoining: '2024-08-01',
    role: 'EMPLOYEE',
    status: 'ACTIVE',
    workMode: 'WFH',
    primaryManager: 'Ravina Khimani',
    monthlySalary: 60000,
    dailyWorkingRequirementMinutes: 480,
    weeklyOff: 'Sunday',
    casualAllowance: 2,
    plannedAllowance: 4,
    sickAllowance: 4,
  },
];

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'HRM Pilot',
  companyLogoUrl: '',
  shiftStartTime: '09:00',
  lunchBreakMinutes: 60,
  halfDayThresholdMinutes: 240,
  loginUrl: '/login',
  employeePortalUrl: '/employee',
  managerPortalUrl: '/manager',
};

const DEFAULT_LEAVES: LeaveRecord[] = [];

const DEFAULT_ATTENDANCE: AttendanceLog[] = [
  {
    id: 'att-1',
    employeeId: 'emp-1',
    date: '2026-07-30',
    attendanceCode: 'P',
    checkIn: '09:00:00',
    checkOut: '18:00:00',
    workedMinutes: 480,
    requiredMinutes: 480,
    shortMinutes: 0,
    extraMinutes: 0,
    sundayWorkedMinutes: 0,
    isManual: false,
  },
  {
    id: 'att-2',
    employeeId: 'emp-2',
    date: '2026-07-30',
    attendanceCode: 'P',
    checkIn: '09:10:00',
    checkOut: '18:00:00',
    workedMinutes: 470,
    requiredMinutes: 480,
    shortMinutes: 10,
    extraMinutes: 0,
    sundayWorkedMinutes: 0,
    isManual: false,
  },
  {
    id: 'att-3',
    employeeId: 'emp-3',
    date: '2026-07-30',
    attendanceCode: 'MP',
    checkIn: '09:30:00',
    checkOut: undefined,
    workedMinutes: 0,
    requiredMinutes: 480,
    shortMinutes: 480,
    extraMinutes: 0,
    sundayWorkedMinutes: 0,
    isManual: false,
  },
];

const DEFAULT_HOLIDAYS: Holiday[] = [
  { id: 'h-2026-01', name: 'New Year', date: '2026-01-01', isOptional: false },
  { id: 'h-2026-02', name: 'Republic Day', date: '2026-01-26', isOptional: false },
  { id: 'h-2026-03', name: 'Holi', date: '2026-03-04', isOptional: false },
  { id: 'h-2026-04', name: 'Independence Day', date: '2026-08-15', isOptional: false },
  { id: 'h-2026-05', name: 'Raksha Bandhan', date: '2026-08-28', isOptional: false },
  { id: 'h-2026-06', name: 'Diwali', date: '2026-11-08', isOptional: false },
  { id: 'h-2026-07', name: 'Diwali (Rama Shama)', date: '2026-11-09', isOptional: false },
  { id: 'h-2026-08', name: 'Christmas', date: '2026-12-25', isOptional: false },
];

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    employeeId: 'emp-1',
    type: 'leave_submitted',
    title: 'New Leave Request Received',
    message: 'Rajesh Kumar has requested Casual Leave from 2026-07-10 to 2026-07-11.',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
];

const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud-1',
    userId: 'emp-1',
    userName: 'Harshit Bhootra',
    action: 'System Initialized',
    objectType: 'System',
    objectId: 'sys-0',
    timestamp: new Date().toISOString(),
  },
];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

let memoryDb: InitialState | null = null;

export function clearMemoryDbCache() {
  memoryDb = null;
  (globalThis as any)._inMemoryDbData = null;
}

export function getDbData(): InitialState {
  if (memoryDb) {
    return memoryDb;
  }

  // 1. Read from primary persistent data store data/db.json
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.employees) && data.employees.length > 0) {
        const existingIds = new Set((data.employees || []).map((e: any) => e.id));
        const rawList = [...(data.employees || [])];
        DEFAULT_EMPLOYEES.forEach(def => {
          if (!existingIds.has(def.id)) {
            rawList.push(def);
          }
        });

        const employeesList = rawList.map((e: any) => ({
          ...e,
          casualAllowance: 2,
          plannedAllowance: 4,
          sickAllowance: 4,
        }));

        memoryDb = {
          employees: employeesList,
          leaveRecords: Array.isArray(data.leaveRecords) ? data.leaveRecords : [],
          attendanceLogs: Array.isArray(data.attendanceLogs) ? data.attendanceLogs : DEFAULT_ATTENDANCE,
          settings: data.settings || DEFAULT_SETTINGS,
          payrollPreviews: data.payrollPreviews || [],
          holidays: data.holidays || DEFAULT_HOLIDAYS,
          auditLogs: data.auditLogs || DEFAULT_AUDIT_LOGS,
          attendanceImports: data.attendanceImports || [],
          notifications: data.notifications || DEFAULT_NOTIFICATIONS,
          departments: data.departments || [],
        };
        (globalThis as any)._inMemoryDbData = memoryDb;
        return memoryDb;
      }
    }
  } catch (e) {
    console.warn('Could not read from primary db.json file:', e);
  }

  // 2. Fallback to /tmp directory if standalone serverless lambda
  try {
    if (fs.existsSync(TMP_DB_FILE)) {
      const raw = fs.readFileSync(TMP_DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.employees) && data.employees.length > 0) {
        const existingIds = new Set(data.employees.map((e: any) => e.id));
        DEFAULT_EMPLOYEES.forEach(def => {
          if (!existingIds.has(def.id)) {
            data.employees.push(def);
          }
        });
        memoryDb = data as InitialState;
        (globalThis as any)._inMemoryDbData = memoryDb;
        return memoryDb;
      }
    }
  } catch (e) {}

  // 3. Ultimate fallback to in-memory defaults
  memoryDb = {
    employees: DEFAULT_EMPLOYEES,
    leaveRecords: DEFAULT_LEAVES,
    attendanceLogs: DEFAULT_ATTENDANCE,
    settings: DEFAULT_SETTINGS,
    payrollPreviews: [],
    holidays: DEFAULT_HOLIDAYS,
    auditLogs: DEFAULT_AUDIT_LOGS,
    attendanceImports: [],
    notifications: DEFAULT_NOTIFICATIONS,
    departments: [],
  };
  (globalThis as any)._inMemoryDbData = memoryDb;
  return memoryDb;
}

export async function ensureCloudSync() {
  try {
    const db = getDbData();
    if (fs.existsSync(TMP_DB_FILE)) {
      try {
        const raw = fs.readFileSync(TMP_DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.leaveRecords)) {
          db.leaveRecords = mergeLeavesNonRegressive(db.leaveRecords || [], parsed.leaveRecords);
        }
        if (Array.isArray(parsed.attendanceLogs) && parsed.attendanceLogs.length > 0) {
          parsed.attendanceLogs.forEach((l: AttendanceLog) => {
            const idx = db.attendanceLogs.findIndex(existing => existing.id === l.id || (existing.employeeId === l.employeeId && existing.date === l.date));
            if (idx !== -1) db.attendanceLogs[idx] = l;
            else db.attendanceLogs.push(l);
          });
        }
      } catch (e) {}
    }
    memoryDb = db;
    (globalThis as any)._inMemoryDbData = db;
  } catch (e) {}
}

async function syncCloudStorageAsync(data: InitialState) {
  // Local storage save is handled directly via saveDbData / saveDbDataAsync
  return;
}

export async function saveDbDataAsync(data: InitialState): Promise<void> {
  memoryDb = data;
  (globalThis as any)._inMemoryDbData = data;
  try {
    ensureDataDir();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    // Read-only filesystem on Vercel
  }

  try {
    fs.writeFileSync(TMP_DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {}

  await syncCloudStorageAsync(data);
}

export function saveDbData(data: InitialState): void {
  saveDbDataAsync(data).catch(() => {});
}

export function addNotification(employeeId: string, type: string, title: string, message: string) {
  const db = getDbData();
  const notif: NotificationItem = {
    id: `notif-${Date.now()}`,
    employeeId,
    type,
    title,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  if (!db.notifications) db.notifications = [];
  db.notifications.unshift(notif);
  saveDbData(db);
}

export function logAudit(action: string, objectType: string, objectId: string, oldValue?: string, newValue?: string) {
  const db = getDbData();
  const entry: AuditLogEntry = {
    id: `aud-${Date.now()}`,
    userId: 'emp-1',
    userName: 'Harshit Bhootra',
    action,
    objectType,
    objectId,
    oldValue,
    newValue,
    timestamp: new Date().toISOString(),
  };
  db.auditLogs.unshift(entry);
  saveDbData(db);
}

function getQuarterFromDateStr(dateStr?: string): string {
  if (!dateStr) return 'Q3';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Q3';
    const m = d.getMonth() + 1;
    if (m >= 1 && m <= 3) return 'Q1';
    if (m >= 4 && m <= 6) return 'Q2';
    if (m >= 7 && m <= 9) return 'Q3';
    if (m >= 10 && m <= 12) return 'Q4';
  } catch (e) {}
  return 'Q3';
}

export function getQuarterlyLeaveSummaries(quarter: string = 'Q3', departmentFilter: string = 'ALL'): LeaveSummary[] {
  const db = getDbData();
  let employees = db.employees;

  if (departmentFilter && departmentFilter !== 'ALL') {
    employees = employees.filter(e => e.department === departmentFilter);
  }

  return employees.map(emp => {
    const empLeaves = db.leaveRecords.filter(l => {
      const targetEmp = String(l.employeeId || '').toLowerCase().trim();
      const empIdStr = String(emp.id || '').toLowerCase().trim();
      const empCodeStr = String(emp.employeeId || '').toLowerCase().trim();
      const empNameStr = String(emp.name || '').toLowerCase().trim();

      const matchesEmp =
        targetEmp === empIdStr ||
        targetEmp === empCodeStr ||
        targetEmp === empNameStr ||
        (targetEmp.length >= 3 && empNameStr.includes(targetEmp)) ||
        (empNameStr.length >= 3 && targetEmp.includes(empNameStr)) ||
        (targetEmp.length >= 3 && empCodeStr.includes(targetEmp));

      const recQuarter = l.quarter || getQuarterFromDateStr(l.startDate);
      const matchesQuarter = recQuarter === quarter;
      // Only count leave in Leave Tracker ONCE APPROVED by both Manager and HR
      const isBothApproved = (l.managerStatus === 'Approved' || l.status === 'APPROVED') && (l.hrStatus === 'Approved' || l.status === 'APPROVED');
      const matchesStatus = isBothApproved || l.status === 'APPROVED';

      return matchesEmp && matchesQuarter && matchesStatus;
    });

    const casualUsed = empLeaves
      .filter(l => l.leaveType === 'Casual Leave')
      .reduce((sum, l) => sum + (l.dayType === 'first_half' || l.dayType === 'second_half' ? 0.5 : l.daysCount), 0);

    const plannedUsed = empLeaves
      .filter(l => l.leaveType === 'Planned Leave' || l.leaveType === 'Sick Leave')
      .reduce((sum, l) => sum + (l.dayType === 'first_half' || l.dayType === 'second_half' ? 0.5 : l.daysCount), 0);

    const totalUsed = casualUsed + plannedUsed;
    const casualAllowance = 2;
    const plannedAllowance = 4;
    const totalAllowance = casualAllowance + plannedAllowance; // 6 Days

    // Deduction / Unpaid LOP triggers ONLY when total leaves taken in a quarter exceed 6 days
    const extraDeduct = Math.max(0, totalUsed - totalAllowance);

    // Month-wise breakdown of extra leaves over 6 days
    let monthDeductionText = '';
    if (extraDeduct > 0) {
      const sortedLeaves = [...empLeaves].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      const monthMap: Record<string, number> = {};
      let cumulative = 0;

      sortedLeaves.forEach(l => {
        const count = l.dayType === 'first_half' || l.dayType === 'second_half' ? 0.5 : l.daysCount;
        const prev = cumulative;
        cumulative += count;

        if (cumulative > totalAllowance) {
          const extraInThis = prev >= totalAllowance ? count : (cumulative - totalAllowance);
          let monthName = 'July';
          try {
            const d = new Date(l.startDate || '2026-07-01');
            if (!isNaN(d.getTime())) {
              monthName = d.toLocaleString('en-US', { month: 'long' });
            }
          } catch (e) {}
          monthMap[monthName] = (monthMap[monthName] || 0) + extraInThis;
        }
      });

      const parts = Object.entries(monthMap).map(([m, count]) => `${m}: ${count} day(s)`);
      monthDeductionText = parts.join(', ');
    }

    const remaining = Math.max(0, totalAllowance - totalUsed);
    const utilizationPercentage = Math.min(100, Math.round((totalUsed / totalAllowance) * 100));

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      avatarUrl: emp.avatarUrl,
      department: emp.department,
      status: emp.status,
      casualUsed,
      plannedUsed,
      totalUsed,
      remaining,
      totalAllowance,
      utilizationPercentage,
      extraDeduct,
      monthDeductionText,
    };
  });
}

export function getEmployeeAllQuarters(employeeId: string) {
  const db = getDbData();
  const cleanSearch = employeeId.trim().toLowerCase();
  const emp = db.employees.find(
    e => e.id.toLowerCase() === cleanSearch || 
         e.employeeId.toLowerCase() === cleanSearch || 
         e.name.toLowerCase() === cleanSearch ||
         e.name.toLowerCase().includes(cleanSearch)
  );
  if (!emp) return null;

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
  const result: Record<string, { label: string; casual: number; planned: number; total: number; remaining: number; extra: number; monthText: string }> = {};

  quarters.forEach(q => {
    const qLeaves = db.leaveRecords.filter(l => {
      const targetEmp = String(l.employeeId || '').toLowerCase().trim();
      const empIdStr = String(emp.id || '').toLowerCase().trim();
      const empCodeStr = String(emp.employeeId || '').toLowerCase().trim();
      const empNameStr = String(emp.name || '').toLowerCase().trim();

      const matchesEmp =
        targetEmp === empIdStr ||
        targetEmp === empCodeStr ||
        targetEmp === empNameStr ||
        (targetEmp.length >= 3 && empNameStr.includes(targetEmp)) ||
        (empNameStr.length >= 3 && targetEmp.includes(empNameStr)) ||
        (targetEmp.length >= 3 && empCodeStr.includes(targetEmp));

      const recQuarter = l.quarter || getQuarterFromDateStr(l.startDate);
      const matchesQuarter = recQuarter === q;
      // Only count leave in Leave Tracker ONCE APPROVED by both Manager and HR
      const isBothApproved = (l.managerStatus === 'Approved' || l.status === 'APPROVED') && (l.hrStatus === 'Approved' || l.status === 'APPROVED');
      const matchesStatus = isBothApproved || l.status === 'APPROVED';

      return matchesEmp && matchesQuarter && matchesStatus;
    });
    const casual = qLeaves
      .filter(l => l.leaveType === 'Casual Leave')
      .reduce((sum, l) => sum + (l.dayType === 'first_half' || l.dayType === 'second_half' ? 0.5 : l.daysCount), 0);
    const planned = qLeaves
      .filter(l => l.leaveType === 'Planned Leave' || l.leaveType === 'Sick Leave')
      .reduce((sum, l) => sum + (l.dayType === 'first_half' || l.dayType === 'second_half' ? 0.5 : l.daysCount), 0);
    const total = casual + planned;
    const remaining = Math.max(0, 6 - total);
    const extra = Math.max(0, total - 6);

    let monthText = '';
    if (extra > 0) {
      const sorted = [...qLeaves].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      const monthMap: Record<string, number> = {};
      let cumulative = 0;

      sorted.forEach(l => {
        const count = l.dayType === 'first_half' || l.dayType === 'second_half' ? 0.5 : l.daysCount;
        const prev = cumulative;
        cumulative += count;

        if (cumulative > 6) {
          const extraInThis = prev >= 6 ? count : (cumulative - 6);
          let monthName = 'July';
          try {
            const d = new Date(l.startDate || '2026-07-01');
            if (!isNaN(d.getTime())) {
              monthName = d.toLocaleString('en-US', { month: 'long' });
            }
          } catch (e) {}
          monthMap[monthName] = (monthMap[monthName] || 0) + extraInThis;
        }
      });

      monthText = Object.entries(monthMap).map(([m, c]) => `${m}: ${c} day(s)`).join(', ');
    }

    const labels: Record<string, string> = { Q1: 'Jan–Mar', Q2: 'Apr–Jun', Q3: 'Jul–Sep', Q4: 'Oct–Dec' };
    result[q] = { label: labels[q], casual, planned, total, remaining, extra, monthText };
  });

  return { employeeName: emp.name, employeeId: emp.employeeId || emp.id, department: emp.department, quarters: result };
}

export function mergeLeavesNonRegressive(primaryList: LeaveRecord[], secondaryList: LeaveRecord[]): LeaveRecord[] {
  if (!Array.isArray(primaryList)) primaryList = [];
  if (!Array.isArray(secondaryList)) secondaryList = [];

  const map = new Map<string, LeaveRecord>();

  const getCleanKey = (l: LeaveRecord): string => {
    if (!l) return '';
    if (l.id) return String(l.id).replace(/[^0-9a-zA-Z_-]/g, '').toLowerCase();
    return `${String(l.employeeId).toLowerCase()}_${l.startDate}_${l.leaveType}`.toLowerCase();
  };

  const processRecord = (record: LeaveRecord) => {
    if (!record) return;
    const key = getCleanKey(record);
    if (!key) return;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...record });
    } else {
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

      const bestStatus =
        (bestManagerStatus === 'Approved' && bestHrStatus === 'Approved') ||
        existing.status === 'APPROVED' ||
        record.status === 'APPROVED'
          ? 'APPROVED'
          : existing.status === 'REJECTED' || record.status === 'REJECTED'
          ? 'REJECTED'
          : record.status || existing.status || 'PENDING';

      map.set(key, {
        ...existing,
        ...record,
        managerStatus: bestManagerStatus,
        hrStatus: bestHrStatus,
        status: bestStatus,
      });
    }
  };

  primaryList.forEach(processRecord);
  secondaryList.forEach(processRecord);

  return Array.from(map.values());
}

