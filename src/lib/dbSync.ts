import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { InitialState } from './store';
import { Employee, LeaveRecord, AttendanceLog, CompanySettings, Holiday, Department, AuditLogEntry, TimeBreak, TimeEntry, BreakConfig, getCurrentQuarter, FeedbackItem } from './types';

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
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
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

    const timeTracking = await loadTimeTrackingFromPrisma();
    formattedEmployees.forEach(e => {
      const prefs = timeTracking.prefs.get(e.id);
      if (prefs) Object.assign(e, prefs);
    });

    const feedbackItems = await loadFeedbackFromPrisma();

    return {
      employees: formattedEmployees,
      leaveRecords: formattedLeaves,
      attendanceLogs: formattedAttendance,
      settings: formattedSettings,
      payrollPreviews: [],
      holidays: formattedHolidays,
      departments: (departments || []).map(d => ({
        id: d.id,
        code: d.code,
        name: d.name,
        managerName: d.managerName || undefined,
        description: d.description || undefined,
        employeeCount: d.employeeCount,
      })),
      auditLogs: formattedAudit,
      attendanceImports: [],
      notifications: [],
      timeEntries: timeTracking.timeEntries,
      timeActivities: timeTracking.timeActivities,
      timeTrackingSettings: timeTracking.timeTrackingSettings,
      feedbackItems,
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
            quarter: l.quarter || getCurrentQuarter(),
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
            quarter: l.quarter || getCurrentQuarter(),
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

  await persistTimeTrackingToPrisma(data);
  await persistFeedbackToPrisma(data);
}

// Time tracking tables are synced separately so a missing table (schema not pushed yet)
// never blocks the core HR data sync.
type EmployeeTrackingPrefs = Pick<Employee, 'timeTrackingEnabled' | 'screenshotsEnabled' | 'screenshotIntervalMinutes' | 'screenshotIntervalMinMinutes' | 'screenshotIntervalMaxMinutes'>;

async function loadTimeTrackingFromPrisma(): Promise<Pick<InitialState, 'timeEntries' | 'timeActivities' | 'timeTrackingSettings'> & { prefs: Map<string, EmployeeTrackingPrefs> }> {
  try {
    const [entries, activities, optIns, settings] = await Promise.all([
      prisma.timeEntry.findMany({ orderBy: { clockIn: 'asc' } }),
      prisma.timeActivity.findMany({ orderBy: { name: 'asc' } }),
      prisma.timeTrackerOptIn.findMany(),
      prisma.timeTrackingSettings.findUnique({ where: { id: 'default' } }),
    ]);
    return {
      prefs: new Map(optIns.map(o => [o.employeeId, {
        timeTrackingEnabled: o.enabled || undefined,
        screenshotsEnabled: o.screenshotsEnabled ?? undefined,
        screenshotIntervalMinutes: o.screenshotInterval ?? undefined,
        screenshotIntervalMinMinutes: (o as any).screenshotIntervalMin ?? undefined,
        screenshotIntervalMaxMinutes: (o as any).screenshotIntervalMax ?? undefined,
      }])),
      timeTrackingSettings: settings ? {
        screenshotsEnabledByDefault: settings.screenshotsEnabledByDefault,
        defaultScreenshotIntervalMinutes: settings.defaultScreenshotIntervalMinutes,
        defaultScreenshotIntervalMinMinutes: (settings as any).defaultScreenshotIntervalMinMinutes ?? undefined,
        defaultScreenshotIntervalMaxMinutes: (settings as any).defaultScreenshotIntervalMaxMinutes ?? undefined,
        screenshotRetentionDays: settings.screenshotRetentionDays ?? 7,
        breaks: Array.isArray((settings as any).breaks) ? ((settings as any).breaks as unknown as BreakConfig[]) : undefined,
      } : undefined,
      timeEntries: entries.map(e => ({
        id: e.id,
        employeeId: e.employeeId,
        date: e.date,
        activity: e.activity,
        note: e.note || undefined,
        clockIn: e.clockIn.toISOString(),
        clockOut: e.clockOut ? e.clockOut.toISOString() : undefined,
        breaks: Array.isArray(e.breaks) ? (e.breaks as unknown as TimeBreak[]) : [],
        source: (e.source as TimeEntry['source']) || 'WEB',
        autoClosed: e.autoClosed,
        editedBy: e.editedBy || undefined,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      timeActivities: activities.length > 0 ? activities : undefined,
    };
  } catch (error) {
    console.warn('[dbSync] Time tracking tables unavailable (run `npx prisma db push`):', error);
    return { timeEntries: [], prefs: new Map() };
  }
}

async function persistTimeTrackingToPrisma(data: InitialState): Promise<void> {
  try {
    for (const emp of data.employees || []) {
      const prefs = {
        enabled: Boolean(emp.timeTrackingEnabled),
        screenshotsEnabled: emp.screenshotsEnabled ?? null,
        screenshotInterval: emp.screenshotIntervalMinutes ?? null,
      };
      try {
        await prisma.timeTrackerOptIn.upsert({
          where: { employeeId: emp.id },
          update: prefs,
          create: { employeeId: emp.id, ...prefs },
        });
      } catch {
        // Table may not exist yet on remote DB
        break;
      }
    }

    if (data.timeTrackingSettings) {
      const s = data.timeTrackingSettings;
      const payload: any = {
        screenshotsEnabledByDefault: s.screenshotsEnabledByDefault,
        defaultScreenshotIntervalMinutes: s.defaultScreenshotIntervalMinutes,
        screenshotRetentionDays: s.screenshotRetentionDays ?? 7,
      };
      if (s.breaks) payload.breaks = s.breaks;
      await prisma.timeTrackingSettings.upsert({
        where: { id: 'default' },
        update: payload,
        create: { id: 'default', ...payload },
      });
    }

    if (data.timeActivities && data.timeActivities.length > 0) {
      const keepIds = data.timeActivities.map(a => a.id);
      await prisma.timeActivity.deleteMany({ where: { id: { notIn: keepIds } } });
      for (const a of data.timeActivities) {
        await prisma.timeActivity.upsert({
          where: { id: a.id },
          update: { name: a.name, color: a.color, isActive: a.isActive },
          create: { id: a.id, name: a.name, color: a.color, isActive: a.isActive },
        });
      }
    }

    // Only the most recently touched sessions change between saves.
    const recent = [...(data.timeEntries || [])]
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
      .slice(0, 100);
    for (const e of recent) {
      const fields = {
        employeeId: e.employeeId,
        date: e.date,
        activity: e.activity || 'Other',
        note: e.note || null,
        clockIn: new Date(e.clockIn),
        clockOut: e.clockOut ? new Date(e.clockOut) : null,
        breaks: (e.breaks || []) as unknown as Prisma.InputJsonValue,
        source: e.source || 'WEB',
        autoClosed: Boolean(e.autoClosed),
        editedBy: e.editedBy || null,
        updatedAt: new Date(e.updatedAt || e.createdAt),
      };
      await prisma.timeEntry.upsert({
        where: { id: e.id },
        update: fields,
        create: { id: e.id, createdAt: new Date(e.createdAt), ...fields },
      });
    }
  } catch (error) {
    console.warn('[dbSync] Failed to persist time tracking data:', error);
  }
}

export async function deleteTimeEntryFromPrisma(id: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.timeEntry.deleteMany({ where: { id } });
  } catch (error) {
    console.warn('[dbSync] Failed to delete time entry:', error);
  }
}

async function loadFeedbackFromPrisma(): Promise<FeedbackItem[]> {
  try {
    const list = await (prisma as any).feedbackTicket?.findMany({ orderBy: { createdAt: 'desc' } });
    if (!list || !Array.isArray(list)) return [];
    return list.map((f: any) => ({
      id: f.id,
      employeeId: f.employeeId,
      employeeName: f.employeeName,
      employeeEmail: f.employeeEmail || undefined,
      department: f.department || undefined,
      category: f.category,
      subject: f.subject || undefined,
      description: f.description,
      imageUrl: f.imageUrl || undefined,
      imageName: f.imageName || undefined,
      status: f.status || 'Pending',
      adminResponse: f.adminResponse || undefined,
      resolvedAt: f.resolvedAt ? new Date(f.resolvedAt).toISOString() : undefined,
      createdAt: f.createdAt ? new Date(f.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : undefined,
    }));
  } catch (error) {
    console.warn('[dbSync] feedbackTicket table unavailable:', error);
    return [];
  }
}

async function persistFeedbackToPrisma(data: InitialState): Promise<void> {
  try {
    if (!data.feedbackItems || data.feedbackItems.length === 0) return;
    for (const f of data.feedbackItems.slice(0, 100)) {
      await (prisma as any).feedbackTicket?.upsert({
        where: { id: f.id },
        update: {
          employeeId: f.employeeId,
          employeeName: f.employeeName,
          employeeEmail: f.employeeEmail || null,
          department: f.department || null,
          category: f.category,
          subject: f.subject || null,
          description: f.description,
          imageUrl: f.imageUrl || null,
          imageName: f.imageName || null,
          status: f.status || 'Pending',
          adminResponse: f.adminResponse || null,
          resolvedAt: f.resolvedAt ? new Date(f.resolvedAt) : null,
          updatedAt: new Date(f.updatedAt || f.createdAt),
        },
        create: {
          id: f.id,
          employeeId: f.employeeId,
          employeeName: f.employeeName,
          employeeEmail: f.employeeEmail || null,
          department: f.department || null,
          category: f.category,
          subject: f.subject || null,
          description: f.description,
          imageUrl: f.imageUrl || null,
          imageName: f.imageName || null,
          status: f.status || 'Pending',
          adminResponse: f.adminResponse || null,
          resolvedAt: f.resolvedAt ? new Date(f.resolvedAt) : null,
          createdAt: new Date(f.createdAt),
          updatedAt: new Date(f.updatedAt || f.createdAt),
        },
      });
    }
  } catch (error) {
    console.warn('[dbSync] Failed to persist feedback tickets to Prisma:', error);
  }
}

export async function deleteFeedbackFromPrisma(id: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await (prisma as any).feedbackTicket?.deleteMany({ where: { id } });
  } catch (error) {
    console.warn('[dbSync] Failed to delete feedback ticket:', error);
  }
}

