export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbData, getQuarterlyLeaveSummaries, getEmployeeAllQuarters, addNotification, logAudit, ensureCloudSync } from '@/lib/store';
import { LeaveRecord, Employee, mergeLeavesNonRegressive, calculateWorkingDaysCount, getLeaveTimestamp } from '@/lib/types';

export async function GET(request: Request) {
  try {
    await ensureCloudSync();
    const { searchParams } = new URL(request.url);
    const quarter = searchParams.get('quarter') || 'Q3';
    const department = searchParams.get('department') || 'ALL';
    const employeeDetails = searchParams.get('employeeDetails');

    if (employeeDetails) {
      const detail = getEmployeeAllQuarters(employeeDetails);
      if (!detail) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, detail });
    }

    const summaries = getQuarterlyLeaveSummaries(quarter, department);
    const db = getDbData();
    const sortedRecords = [...(db.leaveRecords || [])].sort((a, b) => getLeaveTimestamp(b) - getLeaveTimestamp(a));

    return NextResponse.json({
      quarter,
      department,
      summaries,
      records: sortedRecords,
      employees: db.employees || [],
    });
  } catch (err: any) {
    console.error('Error in GET /api/leaves:', err);
    const db = getDbData();
    return NextResponse.json({
      quarter: 'Q3',
      department: 'ALL',
      summaries: [],
      records: db.leaveRecords || [],
      employees: db.employees || [],
      error: err.message || 'Internal server error',
    });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCloudSync();
    const body = await request.json();

    // 0. Clear All Leaves Action (for testing & reset)
    if (body.action === 'clear' || body.action === 'clear_all') {
      const db = getDbData();
      const targetQ = body.quarter || 'Q3';
      db.leaveRecords = [];
      saveDbData(db);

      try {
        await fetch('https://api.restful-api.dev/objects/ff8081819ff5b11001a01eda01715b3e', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'hrm_pilot_leaves',
            data: { leaveRecords: [] },
          }),
        });
      } catch (cloudErr) {
        console.warn('Cloud clear warning:', cloudErr);
      }

      logAudit('Clear All Leaves', 'LeaveRecord', 'all', undefined, 'All leave records cleared by HR');
      const summaries = getQuarterlyLeaveSummaries(targetQ, 'ALL');
      return NextResponse.json({ success: true, message: 'All leave records have been cleared!', summaries, records: [] });
    }

    // 0b. Sync Client Backup Action (restore/merge non-regressively from client backup)
    if (body.action === 'sync_client_backup' && Array.isArray(body.records) && body.records.length > 0) {
      const db = getDbData();
      db.leaveRecords = mergeLeavesNonRegressive(db.leaveRecords || [], body.records);
      saveDbData(db);
      logAudit('Sync Client Backup Leaves', 'LeaveRecord', 'backup', undefined, `Synced ${body.records.length} records from client backup`);
      const targetQ = body.quarter || 'Q3';
      const summaries = getQuarterlyLeaveSummaries(targetQ, 'ALL');
      return NextResponse.json({ success: true, message: 'Synced leave records from client backup', summaries, records: db.leaveRecords });
    }

    // 1. Manual Numerical Override Action (from EditTrackerModal)
    if (body.action === 'override') {
      const { employeeName, quarter, casualUsed, plannedUsed } = body;
      const db = getDbData();
      const emp = db.employees.find(e => e.name === employeeName || e.id === employeeName || e.employeeId === employeeName);
      if (!emp) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      // Remove existing approved records for this quarter and create specific override entries
      db.leaveRecords = db.leaveRecords.filter(
        l => !((l.employeeId === emp.id || l.employeeId === emp.employeeId || l.employeeId === emp.name) && l.quarter === quarter && l.status === 'APPROVED')
      );

      const targetQuarter = quarter || 'Q3';
      let datePrefix = '2026-08-15';
      if (targetQuarter === 'Q1') datePrefix = '2026-02-15';
      else if (targetQuarter === 'Q2') datePrefix = '2026-05-15';
      else if (targetQuarter === 'Q3') datePrefix = '2026-08-15';
      else if (targetQuarter === 'Q4') datePrefix = '2026-11-15';

      if (casualUsed > 0) {
        db.leaveRecords.unshift({
          id: `l-override-cas-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          leaveType: 'Casual Leave',
          dayType: 'full',
          startDate: datePrefix,
          endDate: datePrefix,
          daysCount: Number(casualUsed),
          quarter: targetQuarter,
          year: 2026,
          status: 'APPROVED',
          managerStatus: 'Approved',
          hrStatus: 'Approved',
          note: 'Manual HR Override (Casual Leave Adjustment)',
          createdAt: new Date().toISOString(),
        });
      }

      if (plannedUsed > 0) {
        db.leaveRecords.unshift({
          id: `l-override-pla-${Date.now()}`,
          employeeId: emp.id,
          employeeName: emp.name,
          leaveType: 'Planned Leave',
          dayType: 'full',
          startDate: datePrefix,
          endDate: datePrefix,
          daysCount: Number(plannedUsed),
          quarter: targetQuarter,
          year: 2026,
          status: 'APPROVED',
          managerStatus: 'Approved',
          hrStatus: 'Approved',
          note: 'Manual HR Override (Planned Leave Adjustment)',
          createdAt: new Date().toISOString(),
        });
      }

      logAudit('Override Quarterly Leave', 'LeaveRecord', emp.id, undefined, JSON.stringify({ casualUsed, plannedUsed, quarter }));
      saveDbData(db);

      const summaries = getQuarterlyLeaveSummaries(targetQuarter, 'ALL');
      return NextResponse.json({ success: true, message: 'Quarterly leave updated', summaries });
    }

    // 2. Batch Import Action (from file upload)
    if (body.action === 'import' && Array.isArray(body.records)) {
      const db = getDbData();
      let importedCount = 0;

      // 2a. Import missing employees from employeeMaster if provided
      if (Array.isArray(body.employeeMaster)) {
        body.employeeMaster.forEach((mEmp: any) => {
          if (mEmp.name) {
            const cleanName = String(mEmp.name).trim();
            const exists = db.employees.some(
              e => e.name.toLowerCase().trim() === cleanName.toLowerCase() || e.employeeId === mEmp.employeeId
            );
            if (!exists) {
              const newEmpId = mEmp.employeeId || `EMP${String(db.employees.length + 1).padStart(3, '0')}`;
              db.employees.push({
                id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                employeeId: newEmpId,
                name: cleanName,
                email: `${cleanName.toLowerCase().replace(/\s+/g, '')}@hrmpilot.com`,
                phone: '+91 98765 00000',
                department: mEmp.department || 'Development',
                designation: 'Staff Member',
                role: 'EMPLOYEE',
                status: 'ACTIVE',
                primaryManager: 'Ravina Khimani',
                monthlySalary: 0,
                dailyWorkingRequirementMinutes: 480,
                weeklyOff: 'Sunday',
                casualAllowance: 2,
                plannedAllowance: 4,
                sickAllowance: 4,
                dateOfJoining: '2024-01-01',
              });
            }
          }
        });
      }

      // 2b. Process leave records
      let targetQuarter = 'Q3';
      body.records.forEach((row: any) => {
        const empName = row.employeeName || row['Employee Name'] || row['Employee'] || row['Name'];
        const quarter = row.quarter || row['Quarter'] || 'Q3';
        targetQuarter = quarter;
        const casual = Number(row.casualUsed || row['Casual Leaves Applied'] || row['Casual Leaves'] || row['Casual'] || 0);
        const planned = Number(row.plannedUsed || row['Planned Leaves Applied'] || row['Planned Leaves'] || row['Planned'] || 0);
        const startDate = row.startDate || (quarter === 'Q1' ? '2026-02-15' : quarter === 'Q2' ? '2026-05-15' : quarter === 'Q3' ? '2026-08-15' : '2026-11-15');
        const endDate = row.endDate || startDate;

        if (empName) {
          const cleanName = String(empName).trim().toLowerCase();
          let emp = db.employees.find(
            e => e.name.toLowerCase().trim() === cleanName || e.employeeId.toLowerCase() === cleanName
          );

          // Fallback fuzzy search (e.g. Naman Bangia vs Naman)
          if (!emp) {
            emp = db.employees.find(
              e => e.name.toLowerCase().includes(cleanName) || cleanName.includes(e.name.toLowerCase().split(' ')[0])
            );
          }

          // If still not found, dynamically create employee
          if (!emp) {
            const rawTitleName = String(empName).trim();
            const newCreatedEmp: Employee = {
              id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              employeeId: `EMP${String(db.employees.length + 1).padStart(3, '0')}`,
              name: rawTitleName,
              email: `${rawTitleName.toLowerCase().replace(/\s+/g, '')}@hrmpilot.com`,
              phone: '+91 98765 00000',
              department: 'Development',
              designation: 'Staff Member',
              role: 'EMPLOYEE',
              status: 'ACTIVE',
              primaryManager: 'Ravina Khimani',
              monthlySalary: 0,
              dailyWorkingRequirementMinutes: 480,
              weeklyOff: 'Sunday',
              casualAllowance: 2,
              plannedAllowance: 4,
              sickAllowance: 4,
              dateOfJoining: '2024-01-01',
            };
            db.employees.push(newCreatedEmp);
            emp = newCreatedEmp;
          }

          if (emp) {
            const empId = emp.id;
            const empCode = emp.employeeId;
            const empNameStr = emp.name;
            // Remove previous imported/override records for this employee & quarter
            db.leaveRecords = db.leaveRecords.filter(
              l => !((l.employeeId === empId || l.employeeId === empCode || l.employeeId === empNameStr) && l.quarter === quarter && l.status === 'APPROVED')
            );

            if (casual > 0) {
              db.leaveRecords.unshift({
                id: `l-imp-cas-${Date.now()}-${Math.random()}`,
                employeeId: emp.id,
                leaveType: 'Casual Leave',
                dayType: 'full',
                startDate,
                endDate,
                daysCount: casual,
                quarter,
                year: 2026,
                status: 'APPROVED',
                note: 'Imported from Leave Policy Tracker',
                createdAt: new Date().toISOString(),
              });
            }

            if (planned > 0) {
              db.leaveRecords.unshift({
                id: `l-imp-pla-${Date.now()}-${Math.random()}`,
                employeeId: emp.id,
                leaveType: 'Planned Leave',
                dayType: 'full',
                startDate,
                endDate,
                daysCount: planned,
                quarter,
                year: 2026,
                status: 'APPROVED',
                note: 'Imported from Leave Policy Tracker',
                createdAt: new Date().toISOString(),
              });
            }
            importedCount++;
          }
        }
      });

      saveDbData(db);
      logAudit('Import Quarterly Leaves', 'LeaveRecord', 'batch', undefined, `Imported ${importedCount} records`);
      const summaries = getQuarterlyLeaveSummaries(targetQuarter, 'ALL');
      return NextResponse.json({ success: true, message: `Successfully imported ${importedCount} employee leave records from spreadsheet!`, summaries });
    }

    // 3. Regular Leave Submission / Record Leave Period
    const employeeId = body.employeeId || 'emp-12';
    const { leaveType, dayType, startDate, endDate, note, handoverNote, emergencyContact, reason } = body;

    if (!startDate) {
      return NextResponse.json({ error: 'Missing required start date' }, { status: 400 });
    }

    const db = getDbData();
    const emp = db.employees.find(e =>
      e.id === employeeId ||
      e.employeeId === employeeId ||
      (body.employeeName && e.name.toLowerCase().trim() === String(body.employeeName).toLowerCase().trim()) ||
      (employeeId && String(e.id).toLowerCase() === String(employeeId).toLowerCase()) ||
      (employeeId && String(e.employeeId).toLowerCase() === String(employeeId).toLowerCase())
    ) || db.employees[0];

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;

    // Optional Overlap Check (bypassed to allow multiple leave submissions for testing)
    // if (!body.allowOverlap) { ... }

    let daysCount = calculateWorkingDaysCount(startDate, endDate, dayType);
    if (typeof body.daysCount === 'number') {
      daysCount = body.daysCount;
    }

    // Determine quarter
    const month = start.getMonth() + 1;
    let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' = body.quarter || 'Q3';
    if (!body.quarter) {
      if (month >= 1 && month <= 3) quarter = 'Q1';
      else if (month >= 4 && month <= 6) quarter = 'Q2';
      else if (month >= 7 && month <= 9) quarter = 'Q3';
      else if (month >= 10 && month <= 12) quarter = 'Q4';
    }

    const isShortHours = Boolean(body.isShortHours || body.status === 'SHORT_HOURS');
    const isHrSubmission = body.isHrSubmission || body.status === 'APPROVED' || body.status === 'SHORT_HOURS' || body.submittedBy === 'HR';
    const managerStatus = body.managerStatus || (isShortHours ? 'Approved (Short Hours)' : isHrSubmission ? 'Approved' : 'Pending');
    const hrStatus = body.hrStatus || (isShortHours ? 'Approved (Short Hours)' : isHrSubmission ? 'Approved' : 'Pending');
    const finalStatus = body.status || (isHrSubmission ? 'APPROVED' : 'PENDING');

    const newRecord: LeaveRecord = {
      id: `l-${Date.now()}`,
      employeeId: emp.id,
      employeeName: emp.name,
      leaveType: leaveType || 'Casual Leave',
      dayType: dayType || 'full',
      startDate,
      endDate: endDate || startDate,
      daysCount,
      quarter,
      year: start.getFullYear(),
      status: finalStatus,
      managerStatus,
      hrStatus,
      isAdjustment: Boolean(body.isAdjustment),
      isShortHours,
      note: note || reason || 'Leave application',
      handoverNote: handoverNote || '',
      emergencyContact: emergencyContact || '',
      createdAt: new Date().toISOString(),
    };

    db.leaveRecords.unshift(newRecord);
    logAudit('Submit Leave Request', 'LeaveRecord', newRecord.id, undefined, JSON.stringify(newRecord));

    if (emp) {
      addNotification(
        emp.id,
        'leave_submitted',
        'Leave Application Submitted',
        `Your request for ${leaveType} (${startDate} to ${endDate || startDate}) has been submitted for approval.`
      );
    }

    saveDbData(db);

    const summaries = getQuarterlyLeaveSummaries(quarter, 'ALL');

    return NextResponse.json({
      success: true,
      message: 'Leave request submitted successfully',
      record: newRecord,
      summaries,
      records: db.leaveRecords,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureCloudSync();
    const body = await request.json();
    const { id, record, status, approverRole, startDate, endDate, daysCount } = body;

    const db = getDbData();
    const cleanId = id ? String(id).replace(/[^0-9]/g, '') : '';
    
    // Find all matching indices (exact ID, numeric suffix, or record employee+date match)
    let matchingIndices: number[] = [];

    db.leaveRecords.forEach((l, idx) => {
      const isExact = l.id === id;
      const lClean = l.id.replace(/[^0-9]/g, '');
      const isCleanMatch = cleanId.length >= 3 && (lClean.endsWith(cleanId) || cleanId.endsWith(lClean));
      const isRecordMatch = record && (l.employeeId === record.employeeId || l.employeeId === record.employeeName) && l.startDate === record.startDate;
      
      if (isExact || isCleanMatch || isRecordMatch) {
        matchingIndices.push(idx);
      }
    });

    // 3. Robust Auto-Recovery: Insert record with target status if missing from server db
    if (matchingIndices.length === 0) {
      const newHrStatus = status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending';
      const newMgrStatus = approverRole === 'MANAGER' ? (status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending') : (status === 'APPROVED' ? 'Approved' : 'Pending');
      const fallbackRecord: LeaveRecord = {
        id: id || `l-${Date.now()}`,
        employeeId: record?.employeeId || body.employeeId || 'emp-8',
        leaveType: record?.leaveType || body.leaveType || 'Casual Leave',
        dayType: record?.dayType || 'full',
        startDate: startDate || record?.startDate || '2026-08-15',
        endDate: endDate || record?.endDate || startDate || record?.startDate || '2026-08-15',
        daysCount: daysCount || record?.daysCount || 1,
        quarter: record?.quarter || 'Q3',
        year: 2026,
        status: status || 'APPROVED',
        managerStatus: newMgrStatus,
        hrStatus: newHrStatus,
        note: record?.note || 'Leave application',
        createdAt: new Date().toISOString(),
      };
      db.leaveRecords.unshift(fallbackRecord);
      matchingIndices = [0];
    }

    // Update ALL matching records to ensure no duplicate pending entries remain
    let updatedRecord: LeaveRecord = db.leaveRecords[matchingIndices[0]];
    
    matchingIndices.forEach((idx) => {
      const oldVal = JSON.stringify(db.leaveRecords[idx]);
      const current = db.leaveRecords[idx];

      if (startDate) current.startDate = startDate;
      if (endDate) current.endDate = endDate;
      if (typeof daysCount === 'number') current.daysCount = daysCount;

      if (approverRole === 'MANAGER') {
        if (status === 'REJECTED') {
          current.status = 'REJECTED';
          current.managerStatus = 'Rejected';
          current.hrStatus = 'Rejected';
        } else if (status === 'APPROVED') {
          current.managerStatus = 'Approved';
          if (current.hrStatus === 'Approved') {
            current.status = 'APPROVED';
          }
        } else {
          current.status = status;
        }
      } else {
        if (status === 'REJECTED') {
          current.status = 'REJECTED';
          current.managerStatus = current.managerStatus || 'Rejected';
          current.hrStatus = 'Rejected';
        } else if (status === 'MORE_INFO_REQUIRED') {
          current.status = 'MORE_INFO_REQUIRED';
        } else if (status === 'APPROVED') {
          current.status = 'APPROVED';
          current.managerStatus = 'Approved';
          current.hrStatus = 'Approved';
        } else {
          current.status = status;
        }
      }

      logAudit(`Leave Request ${current.status}`, 'LeaveRecord', current.id, oldVal, JSON.stringify(current));

      const emp = db.employees.find(e => e.id === current.employeeId);
      if (emp) {
        addNotification(
          emp.id,
          'leave_status_updated',
          `Leave Request ${current.status}`,
          `Your leave request #${current.id} status is now ${current.status}. Manager: ${current.managerStatus || 'Pending'}, HR: ${current.hrStatus || 'Pending'}.`
        );
      }
      updatedRecord = current;
    });

    await saveDbData(db);

    const targetQuarter = updatedRecord.quarter || 'Q3';
    const summaries = getQuarterlyLeaveSummaries(targetQuarter, 'ALL');

    return NextResponse.json({
      success: true,
      record: updatedRecord,
      records: db.leaveRecords,
      summaries,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const db = getDbData();
    db.leaveRecords = [];
    saveDbData(db);

    try {
      await fetch('https://api.restful-api.dev/objects/ff8081819ff5b11001a01eda01715b3e', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'hrm_pilot_leaves',
          data: { leaveRecords: [] },
        }),
      });
    } catch (cloudErr) {}

    logAudit('Clear All Leaves History', 'LeaveRecord', 'all', undefined, 'All leave records cleared by HR');
    return NextResponse.json({ success: true, message: 'All leave history records cleared successfully', records: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

