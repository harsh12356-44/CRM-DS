import { prisma } from './prisma';
import { InitialState, Employee, LeaveRecord, AttendanceLog, CompanySettings, Holiday, Department, AuditLogEntry } from './types';

export async function loadDataFromPrisma(): Promise<InitialState | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const [
      employees,
      leaveRecords,
      attendanceLogs,
      settings,
      holidays,
      departments,
      auditLogs
    ] = await Promise.all([
      prisma.employee.findMany({ orderBy: { employeeId: 'asc' } }),
      prisma.leaveRecord.findMany({ orderBy: { startDate: 'asc' } }),
      prisma.attendanceLog.findMany({ orderBy: { date: 'asc' } }),
      prisma.companySettings.findUnique({ where: { id: 'default' } }),
      prisma.holiday.findMany({ orderBy: { date: 'asc' } }),
      prisma.department.findMany({ orderBy: { name: 'asc' } }),
      prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 200 }),
    ]);

    if (!employees || employees.length === 0) {
      return null;
    }

    const formattedEmployees: Employee[] = employees.map(e => ({
      id: e.id,
      employeeId: e.employeeId,
      name: e.name,
      email: e.email,
      phone: e.phone || undefined,
      avatarUrl: e.avatarUrl || undefined,
      department: e.department,
      designation: e.designation || undefined,
      dateOfJoining: e.dateOfJoining || undefined,
      role: e.role as any,
      status: e.status as any,
      monthlySalary: e.monthlySalary,
      dailyWorkingRequirementMinutes: e.dailyWorkingRequirementMinutes,
      weeklyOff: e.weeklyOff,
      casualAllowance: e.casualAllowance,
      plannedAllowance: e.plannedAllowance,
      sickAllowance: e.sickAllowance,
      password: e.password || 'Employee@123',
      workMode: (e.workMode as any) || 'OFFICE',
    }));

    const formattedLeaves: LeaveRecord[] = leaveRecords.map(l => ({
      id: l.id,
      employeeId: l.employeeId,
      leaveType: l.leaveType as any,
      dayType: l.dayType as any,
      startDate: l.startDate,
      endDate: l.endDate,
      daysCount: l.daysCount,
      quarter: l.quarter as any,
      year: l.year,
      status: l.status as any,
      note: l.note || undefined,
      handoverNote: l.handoverNote || undefined,
      emergencyContact: l.emergencyContact || undefined,
    }));

    const formattedAttendance: AttendanceLog[] = attendanceLogs.map(a => ({
      id: a.id,
      employeeId: a.employeeId,
      date: a.date,
      attendanceCode: a.attendanceCode as any,
      checkIn: a.checkIn || undefined,
      checkOut: a.checkOut || undefined,
      workedMinutes: a.workedMinutes,
      requiredMinutes: a.requiredMinutes,
      shortMinutes: a.shortMinutes,
      extraMinutes: a.extraMinutes,
      sundayWorkedMinutes: a.sundayWorkedMinutes,
      isManual: a.isManual,
      correctionReason: a.correctionReason || undefined,
      location: a.location || 'Office Main Gate',
    }));

    const formattedHolidays: Holiday[] = holidays.map(h => ({
      id: h.id,
      name: h.name,
      date: h.date,
      isOptional: h.isOptional,
    }));

    const formattedSettings: CompanySettings = settings ? {
      companyName: settings.companyName,
      companyLogoUrl: settings.companyLogoUrl,
      shiftStartTime: settings.shiftStartTime,
      lunchBreakMinutes: settings.lunchBreakMinutes,
      halfDayThresholdMinutes: settings.halfDayThresholdMinutes,
      loginUrl: settings.loginUrl,
      employeePortalUrl: settings.employeePortalUrl,
      managerPortalUrl: settings.managerPortalUrl,
    } : {
      companyName: 'HRM Pilot',
      companyLogoUrl: '',
      shiftStartTime: '09:00',
      lunchBreakMinutes: 60,
      halfDayThresholdMinutes: 240,
      loginUrl: '/login',
      employeePortalUrl: '/employee',
      managerPortalUrl: '/manager',
    };

    const formattedAudit: AuditLogEntry[] = auditLogs.map(a => ({
      id: a.id,
      userId: a.userId,
      userName: a.userName,
      action: a.action,
      objectType: a.objectType,
      objectId: a.objectId,
      oldValue: a.oldValue || undefined,
      newValue: a.newValue || undefined,
      timestamp: a.timestamp.toISOString(),
    }));

    return {
      employees: formattedEmployees,
      leaveRecords: formattedLeaves,
      attendanceLogs: formattedAttendance,
      settings: formattedSettings,
      payrollPreviews: [],
      holidays: formattedHolidays,
      departments: departments,
      auditLogs: formattedAudit,
      attendanceImports: [],
      notifications: [],
    };
  } catch (error) {
    console.error('[dbSync] Failed to load data from Prisma/Supabase:', error);
    return null;
  }
}

export async function persistDataToPrisma(data: InitialState): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    // 1. Persist Employees
    if (data.employees && data.employees.length > 0) {
      for (const emp of data.employees) {
        await prisma.employee.upsert({
          where: { id: emp.id },
          update: {
            employeeId: emp.employeeId || emp.id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone || null,
            avatarUrl: emp.avatarUrl || null,
            department: emp.department || 'General',
            designation: emp.designation || null,
            dateOfJoining: emp.dateOfJoining || null,
            role: emp.role || 'EMPLOYEE',
            status: emp.status || 'ACTIVE',
            monthlySalary: Number(emp.monthlySalary) || 0,
            dailyWorkingRequirementMinutes: Number(emp.dailyWorkingRequirementMinutes) || 480,
            weeklyOff: emp.weeklyOff || 'Sunday',
            casualAllowance: Number(emp.casualAllowance) ?? 2,
            plannedAllowance: Number(emp.plannedAllowance) ?? 4,
            sickAllowance: Number(emp.sickAllowance) ?? 4,
            password: emp.password || 'Employee@123',
            workMode: emp.workMode || 'OFFICE',
          },
          create: {
            id: emp.id,
            employeeId: emp.employeeId || emp.id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone || null,
            avatarUrl: emp.avatarUrl || null,
            department: emp.department || 'General',
            designation: emp.designation || null,
            dateOfJoining: emp.dateOfJoining || null,
            role: emp.role || 'EMPLOYEE',
            status: emp.status || 'ACTIVE',
            monthlySalary: Number(emp.monthlySalary) || 0,
            dailyWorkingRequirementMinutes: Number(emp.dailyWorkingRequirementMinutes) || 480,
            weeklyOff: emp.weeklyOff || 'Sunday',
            casualAllowance: Number(emp.casualAllowance) ?? 2,
            plannedAllowance: Number(emp.plannedAllowance) ?? 4,
            sickAllowance: Number(emp.sickAllowance) ?? 4,
            password: emp.password || 'Employee@123',
            workMode: emp.workMode || 'OFFICE',
          },
        });
      }
    }

    // 2. Persist Leave Records
    if (data.leaveRecords && data.leaveRecords.length > 0) {
      for (const l of data.leaveRecords) {
        await prisma.leaveRecord.upsert({
          where: { id: String(l.id) },
          update: {
            employeeId: l.employeeId,
            leaveType: l.leaveType || 'Planned Leave',
            dayType: l.dayType || 'full',
            startDate: l.startDate,
            endDate: l.endDate || l.startDate,
            daysCount: Number(l.daysCount) || 1,
            quarter: l.quarter || 'Q3',
            year: Number(l.year) || 2026,
            status: l.status || 'APPROVED',
            note: l.note || null,
            handoverNote: l.handoverNote || null,
            emergencyContact: l.emergencyContact || null,
          },
          create: {
            id: String(l.id),
            employeeId: l.employeeId,
            leaveType: l.leaveType || 'Planned Leave',
            dayType: l.dayType || 'full',
            startDate: l.startDate,
            endDate: l.endDate || l.startDate,
            daysCount: Number(l.daysCount) || 1,
            quarter: l.quarter || 'Q3',
            year: Number(l.year) || 2026,
            status: l.status || 'APPROVED',
            note: l.note || null,
            handoverNote: l.handoverNote || null,
            emergencyContact: l.emergencyContact || null,
          },
        });
      }
    }

    // 3. Persist Attendance Logs
    if (data.attendanceLogs && data.attendanceLogs.length > 0) {
      // Upsert recent logs or save in chunks
      for (const a of data.attendanceLogs.slice(-200)) {
        await prisma.attendanceLog.upsert({
          where: { id: String(a.id) },
          update: {
            employeeId: a.employeeId,
            date: a.date,
            attendanceCode: a.attendanceCode || 'P',
            checkIn: a.checkIn || null,
            checkOut: a.checkOut || null,
            workedMinutes: Number(a.workedMinutes) || 0,
            requiredMinutes: Number(a.requiredMinutes) || 480,
            shortMinutes: Number(a.shortMinutes) || 0,
            extraMinutes: Number(a.extraMinutes) || 0,
            sundayWorkedMinutes: Number(a.sundayWorkedMinutes) || 0,
            isManual: Boolean(a.isManual),
            correctionReason: a.correctionReason || null,
            location: a.location || 'Office Main Gate',
          },
          create: {
            id: String(a.id),
            employeeId: a.employeeId,
            date: a.date,
            attendanceCode: a.attendanceCode || 'P',
            checkIn: a.checkIn || null,
            checkOut: a.checkOut || null,
            workedMinutes: Number(a.workedMinutes) || 0,
            requiredMinutes: Number(a.requiredMinutes) || 480,
            shortMinutes: Number(a.shortMinutes) || 0,
            extraMinutes: Number(a.extraMinutes) || 0,
            sundayWorkedMinutes: Number(a.sundayWorkedMinutes) || 0,
            isManual: Boolean(a.isManual),
            correctionReason: a.correctionReason || null,
            location: a.location || 'Office Main Gate',
          },
        });
      }
    }

    // 4. Persist Company Settings
    if (data.settings) {
      await prisma.companySettings.upsert({
        where: { id: 'default' },
        update: {
          companyName: data.settings.companyName || 'HRM Pilot',
          companyLogoUrl: data.settings.companyLogoUrl || '',
          shiftStartTime: data.settings.shiftStartTime || '09:00',
          lunchBreakMinutes: Number(data.settings.lunchBreakMinutes) || 60,
          halfDayThresholdMinutes: Number(data.settings.halfDayThresholdMinutes) || 240,
          loginUrl: data.settings.loginUrl || '/login',
          employeePortalUrl: data.settings.employeePortalUrl || '/employee',
          managerPortalUrl: data.settings.managerPortalUrl || '/manager',
        },
        create: {
          id: 'default',
          companyName: data.settings.companyName || 'HRM Pilot',
          companyLogoUrl: data.settings.companyLogoUrl || '',
          shiftStartTime: data.settings.shiftStartTime || '09:00',
          lunchBreakMinutes: Number(data.settings.lunchBreakMinutes) || 60,
          halfDayThresholdMinutes: Number(data.settings.halfDayThresholdMinutes) || 240,
          loginUrl: data.settings.loginUrl || '/login',
          employeePortalUrl: data.settings.employeePortalUrl || '/employee',
          managerPortalUrl: data.settings.managerPortalUrl || '/manager',
        },
      });
    }
  } catch (error) {
    console.error('[dbSync] Failed to persist data to Prisma/Supabase:', error);
  }
}
