const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting migration to Supabase PostgreSQL...');

  const dbPath = path.join(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    throw new Error('data/db.json not found! Run sync_from_hostinger.js first.');
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // 1. Company Settings
  console.log('1️⃣ Migrating Company Settings...');
  const s = db.settings || {};
  await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {
      companyName: s.companyName || 'HRM Pilot',
      companyLogoUrl: s.companyLogoUrl || '',
      shiftStartTime: s.shiftStartTime || '09:00',
      lunchBreakMinutes: Number(s.lunchBreakMinutes) || 60,
      halfDayThresholdMinutes: Number(s.halfDayThresholdMinutes) || 240,
      loginUrl: s.loginUrl || '/login',
      employeePortalUrl: s.employeePortalUrl || '/employee',
      managerPortalUrl: s.managerPortalUrl || '/manager',
    },
    create: {
      id: 'default',
      companyName: s.companyName || 'HRM Pilot',
      companyLogoUrl: s.companyLogoUrl || '',
      shiftStartTime: s.shiftStartTime || '09:00',
      lunchBreakMinutes: Number(s.lunchBreakMinutes) || 60,
      halfDayThresholdMinutes: Number(s.halfDayThresholdMinutes) || 240,
      loginUrl: s.loginUrl || '/login',
      employeePortalUrl: s.employeePortalUrl || '/employee',
      managerPortalUrl: s.managerPortalUrl || '/manager',
    }
  });

  // 2. Departments
  console.log(`2️⃣ Migrating ${db.departments?.length || 0} Departments...`);
  for (const dept of (db.departments || [])) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {
        code: dept.code || dept.name.slice(0, 3).toUpperCase(),
        managerName: dept.managerName || 'Harshit Bhootra',
        description: dept.description || '',
        employeeCount: Number(dept.employeeCount) || 0,
      },
      create: {
        id: dept.id || `dept-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        code: dept.code || dept.name.slice(0, 3).toUpperCase(),
        name: dept.name,
        managerName: dept.managerName || 'Harshit Bhootra',
        description: dept.description || '',
        employeeCount: Number(dept.employeeCount) || 0,
      }
    });
  }

  // 3. Holidays
  console.log(`3️⃣ Migrating ${db.holidays?.length || 0} Holidays...`);
  for (const h of (db.holidays || [])) {
    await prisma.holiday.upsert({
      where: { id: h.id },
      update: {
        name: h.name,
        date: h.date,
        isOptional: Boolean(h.isOptional),
      },
      create: {
        id: h.id,
        name: h.name,
        date: h.date,
        isOptional: Boolean(h.isOptional),
      }
    });
  }

  // 4. Employees
  console.log(`4️⃣ Migrating ${db.employees?.length || 0} Employees...`);
  for (const emp of (db.employees || [])) {
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
      }
    });
  }

  // 5. Leave Records
  console.log(`5️⃣ Migrating ${db.leaveRecords?.length || 0} Leave Records...`);
  for (const l of (db.leaveRecords || [])) {
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
      }
    });
  }

  // 6. Attendance Logs
  console.log(`6️⃣ Migrating ${db.attendanceLogs?.length || 0} Attendance Logs...`);
  // Clean existing and bulk insert to ensure high speed
  await prisma.attendanceLog.deleteMany({});
  
  const CHUNK_SIZE = 250;
  for (let i = 0; i < (db.attendanceLogs || []).length; i += CHUNK_SIZE) {
    const chunk = db.attendanceLogs.slice(i, i + CHUNK_SIZE).map((l, idx) => ({
      id: l.id ? String(l.id) : `att-${i + idx}-${Date.now()}`,
      employeeId: l.employeeId,
      date: l.date,
      attendanceCode: l.attendanceCode || 'P',
      checkIn: l.checkIn || null,
      checkOut: l.checkOut || null,
      workedMinutes: Number(l.workedMinutes) || 0,
      requiredMinutes: Number(l.requiredMinutes) || 480,
      shortMinutes: Number(l.shortMinutes) || 0,
      extraMinutes: Number(l.extraMinutes) || 0,
      sundayWorkedMinutes: Number(l.sundayWorkedMinutes) || 0,
      isManual: Boolean(l.isManual),
      correctionReason: l.correctionReason || null,
      location: l.location || 'Office Main Gate',
    }));

    await prisma.attendanceLog.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    console.log(`   - Inserted logs ${i + 1} to ${Math.min(i + CHUNK_SIZE, db.attendanceLogs.length)}...`);
  }

  // 7. Audit Logs
  if (db.auditLogs && db.auditLogs.length > 0) {
    console.log(`7️⃣ Migrating ${db.auditLogs.length} Audit Logs...`);
    await prisma.auditLog.deleteMany({});
    const auditChunks = 200;
    for (let i = 0; i < db.auditLogs.length; i += auditChunks) {
      const chunk = db.auditLogs.slice(i, i + auditChunks).map((a, idx) => ({
        id: a.id ? String(a.id) : `aud-${i + idx}-${Date.now()}`,
        userId: a.userId || 'emp-1',
        userName: a.userName || 'Harshit Bhootra',
        action: a.action || 'Action',
        objectType: a.objectType || 'System',
        objectId: a.objectId || 'sys',
        oldValue: a.oldValue || null,
        newValue: a.newValue || null,
        ipAddress: a.ipAddress || null,
        timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
      }));
      await prisma.auditLog.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }
  }

  console.log('\n📊 Verifying Supabase PostgreSQL counts...');
  const [empCount, leaveCount, logCount, holCount, deptCount, audCount] = await Promise.all([
    prisma.employee.count(),
    prisma.leaveRecord.count(),
    prisma.attendanceLog.count(),
    prisma.holiday.count(),
    prisma.department.count(),
    prisma.auditLog.count(),
  ]);

  console.log(`✨ SUPABASE MIGRATION COMPLETE:`);
  console.log(`   - Employees in DB: ${empCount} (Expected: ${db.employees.length})`);
  console.log(`   - Leave Records in DB: ${leaveCount} (Expected: ${db.leaveRecords.length})`);
  console.log(`   - Attendance Logs in DB: ${logCount} (Expected: ${db.attendanceLogs.length})`);
  console.log(`   - Holidays in DB: ${holCount} (Expected: ${db.holidays.length})`);
  console.log(`   - Departments in DB: ${deptCount} (Expected: ${db.departments.length})`);
  console.log(`   - Audit Logs in DB: ${audCount} (Expected: ${db.auditLogs.length})`);
}

main()
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
