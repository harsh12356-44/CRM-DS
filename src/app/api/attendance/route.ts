export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbData, saveDbDataAsync, logAudit, ensureCloudSync } from '@/lib/store';
import { AttendanceLog, AttendanceImport } from '@/lib/types';
import { parseBiometricPunches, parsePunchTimes } from '@/lib/biometricParser';

export async function GET(request: Request) {
  await ensureCloudSync();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const month = searchParams.get('month');
  const year = searchParams.get('year') || '2026';
  const monthYear = searchParams.get('monthYear');
  const department = searchParams.get('department') || 'ALL';

  const db = getDbData();
  let logs = db.attendanceLogs || [];
  let employees = db.employees || [];

  if (department !== 'ALL') {
    employees = employees.filter(e => e.department === department);
    const deptEmpIds = new Set(employees.flatMap(e => [e.id, e.employeeId, e.name.toLowerCase()]));
    logs = logs.filter(l => deptEmpIds.has(l.employeeId) || deptEmpIds.has(l.employeeId?.toLowerCase()));
  }

  if (date) {
    logs = logs.filter(l => l.date === date);
  } else if (monthYear) {
    logs = logs.filter(l => l.date.startsWith(monthYear));
  } else if (month) {
    const padMonth = String(month).padStart(2, '0');
    const targetPrefix = `${year}-${padMonth}`;
    const rawMonthNum = Number(month);
    logs = logs.filter(l => {
      if (!l.date) return false;
      if (l.date.startsWith(targetPrefix)) return true;
      const parts = l.date.split('-');
      if (parts.length >= 2) {
        return parts[0] === year && Number(parts[1]) === rawMonthNum;
      }
      return false;
    });
  }

  const enrichedLogs = logs.map(l => {
    const emp = db.employees.find(
      e => e.id === l.employeeId || e.employeeId === l.employeeId || (e.name && l.employeeId && e.name.toLowerCase() === l.employeeId.toLowerCase())
    );
    return {
      ...l,
      employeeId: emp ? emp.id : l.employeeId, // Canonicalize to emp.id so Working Hours UI maps 1:1
      employeeName: emp ? emp.name : l.employeeId,
      department: emp ? emp.department : 'General',
    };
  });

  return NextResponse.json(
    {
      logs: enrichedLogs,
      employees: db.employees,
      imports: db.attendanceImports || [],
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDbData();

    // 0. Sync Client Backup Action (auto-recovery from browser backup on Vercel lambda cold starts)
    if (body.action === 'sync_client_backup' && Array.isArray(body.logs) && body.logs.length > 0) {
      let restoredCount = 0;
      body.logs.forEach((clientLog: any) => {
        if (clientLog && clientLog.employeeId && clientLog.date) {
          const exists = db.attendanceLogs.some(
            l => (l.employeeId === clientLog.employeeId || l.employeeId === clientLog.employeeId) && l.date === clientLog.date
          );
          if (!exists) {
            db.attendanceLogs.push(clientLog);
            restoredCount++;
          }
        }
      });
      if (restoredCount > 0) {
        await saveDbDataAsync(db);
        logAudit('Sync Client Backup Attendance', 'AttendanceLog', 'backup', undefined, `Restored ${restoredCount} records from client backup`);
      }
      return NextResponse.json({ success: true, message: `Restored ${restoredCount} attendance logs from client backup`, logs: db.attendanceLogs });
    }

    // 1. Monthly Punches Upload
    if (body.action === 'IMPORT' || body.action === 'IMPORT_MONTHLY_PUNCHES') {
      const rawRows = body.rows || [];
      const monthYear = body.monthYear || '2026-07';

      const parsedLogs = parseBiometricPunches(rawRows, db.employees, monthYear);

      if (parsedLogs.length > 0) {
        parsedLogs.forEach(newLog => {
          const existingIdx = db.attendanceLogs.findIndex(
            l => (l.employeeId === newLog.employeeId || l.employeeId === newLog.employeeId) && l.date === newLog.date
          );
          if (existingIdx !== -1) {
            db.attendanceLogs[existingIdx] = newLog;
          } else {
            db.attendanceLogs.push(newLog);
          }
        });
      }

      const uniqueEmps = new Set(parsedLogs.map(l => l.employeeId)).size;

      const newImport: AttendanceImport = {
        id: `imp-${Date.now()}`,
        filename: body.filename || 'monthly_punches.xls',
        uploadedBy: 'Ravina Khimani',
        uploadDate: new Date().toISOString(),
        totalEmployees: uniqueEmps || db.employees.length,
        totalRows: parsedLogs.length || rawRows.length,
        importedRows: parsedLogs.length || rawRows.length,
        missingPunches: parsedLogs.filter(l => l.attendanceCode === 'MP').length,
        status: 'Completed',
      };

      db.attendanceImports.unshift(newImport);
      logAudit('Import Biometric Monthly Punches', 'AttendanceImport', newImport.id, undefined, newImport.filename);
      await saveDbDataAsync(db);

      return NextResponse.json({ success: true, import: newImport, logs: db.attendanceLogs, totalLogsParsed: parsedLogs.length });
    }

    // 2. Completed Hours Import
    if (body.action === 'IMPORT_COMPLETED_HOURS') {
      const rows = body.rows || [];
      const monthYear = body.monthYear || '2026-08';
      const [targetYear, targetMonth] = monthYear.split('-').map(Number);
      const totalDaysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      let importedCount = 0;

      if (Array.isArray(rows) && rows.length > 0) {
        rows.forEach((row: any) => {
          if (!row) return;

          let rawEmpCode = '';
          let rawEmpName = '';
          let totalHours = 0;
          let specificDate = '';

          if (Array.isArray(row)) {
            // 2D Array format: row = [Code/ID, Name, ..., Hours]
            rawEmpCode = String(row[0] || '').trim();
            rawEmpName = String(row[1] || row[2] || '').trim();

            for (let c = row.length - 1; c >= 0; c--) {
              const val = parseFloat(String(row[c]));
              if (!isNaN(val) && val > 0 && val < 500) {
                totalHours = val;
                break;
              }
            }
          } else {
            // Object format: row = { "Emp Code": "HB001", "Emp Name": "Harsh", "Completed Hours": 180, ... }
            const keys = Object.keys(row);
            const findVal = (patterns: string[]) => {
              const matchedKey = keys.find(k => patterns.some(p => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p)));
              return matchedKey ? String(row[matchedKey] || '').trim() : '';
            };

            rawEmpCode = findVal(['employeeid', 'empcode', 'code', 'empid', 'id']);
            rawEmpName = findVal(['employeename', 'empname', 'name', 'fullname', 'staffname']);
            specificDate = findVal(['date', 'workdate', 'attendancedate']);

            const hoursValStr = findVal(['completedhours', 'totalhours', 'workedhours', 'hours', 'nethours', 'shifthours', 'completed', 'worked']);
            if (hoursValStr) {
              const numVal = parseFloat(hoursValStr);
              if (!isNaN(numVal) && numVal > 0) {
                totalHours = numVal;
              }
            }
          }

          // Skip header row if rawEmpCode or rawEmpName looks like a column title
          if (rawEmpCode.toLowerCase().includes('code') || rawEmpName.toLowerCase().includes('name') || rawEmpCode.toLowerCase().includes('employee')) return;
          if (!rawEmpName && !rawEmpCode) return;

          const matchedEmp = db.employees.find(e => {
            if (rawEmpCode && (
              e.id.toLowerCase() === rawEmpCode.toLowerCase() || 
              e.employeeId.toLowerCase() === rawEmpCode.toLowerCase() ||
              (rawEmpCode.replace(/[^0-9]/g, '') && e.id.replace(/[^0-9]/g, '') === rawEmpCode.replace(/[^0-9]/g, ''))
            )) return true;

            if (rawEmpName) {
              const sysName = e.name.toLowerCase().trim();
              const inputName = rawEmpName.toLowerCase().trim();
              if (sysName.includes(inputName) || inputName.includes(sysName)) return true;
              const inputFirst = inputName.split(' ')[0];
              const sysFirst = sysName.split(' ')[0];
              if (inputFirst.length >= 3 && sysFirst === inputFirst) return true;
            }
            return false;
          });

          if (matchedEmp) {
            importedCount++;

            if (specificDate && specificDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Row specifies a specific date
              const workedMins = Math.round(totalHours <= 24 ? totalHours * 60 : totalHours);
              const dateStr = specificDate;
              const existingIdx = db.attendanceLogs.findIndex(
                l => (l.employeeId === matchedEmp.id || l.employeeId === matchedEmp.employeeId) && l.date === dateStr
              );

              if (existingIdx !== -1) {
                db.attendanceLogs[existingIdx].employeeId = matchedEmp.id;
                db.attendanceLogs[existingIdx].workedMinutes = workedMins;
                db.attendanceLogs[existingIdx].shortMinutes = Math.max(0, 480 - workedMins);
                db.attendanceLogs[existingIdx].extraMinutes = Math.max(0, workedMins - 480);
                db.attendanceLogs[existingIdx].attendanceCode = workedMins > 0 ? 'P' : 'A';
              } else {
                db.attendanceLogs.push({
                  id: `att-${matchedEmp.id}-${dateStr}`,
                  employeeId: matchedEmp.id,
                  date: dateStr,
                  checkIn: '09:00',
                  checkOut: '18:00',
                  workedMinutes: workedMins,
                  requiredMinutes: 480,
                  shortMinutes: Math.max(0, 480 - workedMins),
                  extraMinutes: Math.max(0, workedMins - 480),
                  attendanceCode: workedMins > 0 ? 'P' : 'A',
                  sundayWorkedMinutes: 0,
                  isManual: false,
                });
              }
            } else {
              // Monthly total completed hours spread across working days
              const totalMins = totalHours > 500 ? totalHours : Math.round(totalHours * 60);

              let workingDaysCount = 0;
              const dateObjs: string[] = [];
              for (let d = 1; d <= totalDaysInMonth; d++) {
                const dayStr = String(d).padStart(2, '0');
                const dateStr = `${monthYear}-${dayStr}`;
                const dt = new Date(`${dateStr}T00:00:00`);
                if (dt.getDay() !== 0) {
                  workingDaysCount++;
                }
                dateObjs.push(dateStr);
              }

              const dailyWorkedMins = workingDaysCount > 0 ? Math.round(totalMins / workingDaysCount) : Math.round(totalMins / totalDaysInMonth);

              dateObjs.forEach(dateStr => {
                const dt = new Date(`${dateStr}T00:00:00`);
                const isSunday = dt.getDay() === 0;
                const existingIdx = db.attendanceLogs.findIndex(
                  l => (l.employeeId === matchedEmp.id || l.employeeId === matchedEmp.employeeId) && l.date === dateStr
                );

                if (isSunday) {
                  if (existingIdx !== -1) {
                    if (db.attendanceLogs[existingIdx].workedMinutes === 0) {
                      db.attendanceLogs[existingIdx].attendanceCode = 'WO';
                    }
                  }
                } else {
                  if (existingIdx !== -1) {
                    db.attendanceLogs[existingIdx].employeeId = matchedEmp.id;
                    db.attendanceLogs[existingIdx].workedMinutes = dailyWorkedMins;
                    db.attendanceLogs[existingIdx].shortMinutes = Math.max(0, 480 - dailyWorkedMins);
                    db.attendanceLogs[existingIdx].extraMinutes = Math.max(0, dailyWorkedMins - 480);
                    db.attendanceLogs[existingIdx].attendanceCode = dailyWorkedMins > 0 ? 'P' : 'A';
                  } else {
                    db.attendanceLogs.push({
                      id: `att-${matchedEmp.id}-${dateStr}`,
                      employeeId: matchedEmp.id,
                      date: dateStr,
                      checkIn: '09:00',
                      checkOut: '18:00',
                      workedMinutes: dailyWorkedMins,
                      requiredMinutes: 480,
                      shortMinutes: Math.max(0, 480 - dailyWorkedMins),
                      extraMinutes: Math.max(0, dailyWorkedMins - 480),
                      attendanceCode: dailyWorkedMins > 0 ? 'P' : 'A',
                      sundayWorkedMinutes: 0,
                      isManual: false,
                    });
                  }
                }
              });
            }
          }
        });
      }

      const newImport: AttendanceImport = {
        id: `imp-hrs-${Date.now()}`,
        filename: body.filename || 'completed_hours.csv',
        uploadedBy: 'Ravina Khimani',
        uploadDate: new Date().toISOString(),
        totalEmployees: importedCount || db.employees.length,
        totalRows: rows.length,
        importedRows: importedCount || rows.length,
        missingPunches: 0,
        status: 'Completed',
      };

      db.attendanceImports.unshift(newImport);
      logAudit('Import Completed Hours Spreadsheet', 'AttendanceImport', newImport.id, undefined, newImport.filename);
      await saveDbDataAsync(db);

      const enrichedLogs = db.attendanceLogs.map(l => {
        const emp = db.employees.find(e => e.id === l.employeeId);
        return {
          ...l,
          employeeName: emp ? emp.name : 'Unknown',
          department: emp ? emp.department : 'General',
        };
      });

      return NextResponse.json({ success: true, import: newImport, logs: enrichedLogs, totalEmployeesUpdated: importedCount });
    }

    if (body.action === 'MANUAL_EDIT') {
      const targetId = body.id || body.logId;
      const { employeeId, date, attendanceCode, checkIn, checkOut } = body;
      const correctionReason = body.correctionReason || body.reason || '';

      const matchedEmp = db.employees.find(e =>
        e.id === employeeId ||
        e.employeeId === employeeId ||
        (e.name && employeeId && e.name.toLowerCase().trim() === String(employeeId).toLowerCase().trim())
      );
      const canonicalEmpId = matchedEmp ? matchedEmp.id : employeeId;
      
      let index = -1;
      if (targetId) {
        index = db.attendanceLogs.findIndex(l => l.id === targetId);
      }
      if (index === -1 && canonicalEmpId && date) {
        index = db.attendanceLogs.findIndex(l => {
          if (l.date !== date) return false;
          if (l.employeeId === canonicalEmpId || l.employeeId === matchedEmp?.employeeId) return true;
          if (matchedEmp && l.employeeId && matchedEmp.name.toLowerCase().trim() === l.employeeId.toLowerCase().trim()) return true;
          return false;
        });
      }

      let workedMinutes = 0;
      if (attendanceCode === 'P' || attendanceCode === 'MP') {
        workedMinutes = 480;
        try {
          if (checkIn && checkOut && checkIn.includes(':') && checkOut.includes(':')) {
            const [inH, inM] = checkIn.split(':').map(Number);
            const [outH, outM] = checkOut.split(':').map(Number);
            if (!isNaN(inH) && !isNaN(outH)) {
              workedMinutes = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM));
            }
          }
        } catch (e) {}
      } else if (attendanceCode === 'HD') {
        workedMinutes = 240;
      }

      const shortMinutes = Math.max(0, 480 - workedMinutes);
      const extraMinutes = Math.max(0, workedMinutes - 480);

      if (index !== -1) {
        const oldVal = JSON.stringify(db.attendanceLogs[index]);
        db.attendanceLogs[index].employeeId = canonicalEmpId;
        db.attendanceLogs[index].attendanceCode = attendanceCode;
        db.attendanceLogs[index].checkIn = checkIn;
        db.attendanceLogs[index].checkOut = checkOut;
        db.attendanceLogs[index].workedMinutes = workedMinutes;
        db.attendanceLogs[index].shortMinutes = shortMinutes;
        db.attendanceLogs[index].extraMinutes = extraMinutes;
        db.attendanceLogs[index].isManual = true;
        db.attendanceLogs[index].correctionReason = correctionReason;

        logAudit('Manual Attendance Correction', 'AttendanceLog', db.attendanceLogs[index].id, oldVal, JSON.stringify(db.attendanceLogs[index]));
        await saveDbDataAsync(db);

        return NextResponse.json({ success: true, log: db.attendanceLogs[index] });
      } else if (canonicalEmpId && date) {
        const newLog: AttendanceLog = {
          id: targetId || `att-${canonicalEmpId}-${date}`,
          employeeId: canonicalEmpId,
          date,
          attendanceCode,
          checkIn,
          checkOut,
          workedMinutes,
          requiredMinutes: 480,
          shortMinutes,
          extraMinutes,
          sundayWorkedMinutes: 0,
          isManual: true,
          correctionReason,
        };

        db.attendanceLogs.push(newLog);
        logAudit('Manual Attendance Entry', 'AttendanceLog', newLog.id, undefined, JSON.stringify(newLog));
        await saveDbDataAsync(db);

        return NextResponse.json({ success: true, log: newLog });
      }

      return NextResponse.json({ error: 'Log entry or target employee date details not found' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error processing attendance' }, { status: 500 });
  }
}
