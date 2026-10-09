export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbData, logAudit } from '@/lib/store';
import { Employee } from '@/lib/types';

export async function GET(request: Request) {
  const db = getDbData();
  const cookieHeader = request.headers.get('cookie') || '';
  const isAdmin = cookieHeader.includes('hrm_user_role=ADMIN');

  if (isAdmin) {
    return NextResponse.json(db.employees);
  }

  // Non-admins (employees, managers, unauthenticated) must never see other employees' passwords
  const sanitized = db.employees.map(e => {
    const { password, ...rest } = e;
    return rest;
  });
  return NextResponse.json(sanitized);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDbData();
    const cookieHeader = request.headers.get('cookie') || '';
    const isAdmin = cookieHeader.includes('hrm_user_role=ADMIN');

    const targetId = body.id || body.employeeId;
    const targetEmail = body.email ? body.email.toLowerCase().trim() : '';
    const targetName = body.name ? body.name.toLowerCase().trim() : '';

    const index = db.employees.findIndex(e => {
      const eId = String(e.id || '').toLowerCase().trim();
      const eEmpId = String(e.employeeId || '').toLowerCase().trim();
      const eEmail = String(e.email || '').toLowerCase().trim();
      const eName = String(e.name || '').toLowerCase().trim();

      const cleanTargetId = String(targetId || '').toLowerCase().trim();

      if (cleanTargetId && (eId === cleanTargetId || eEmpId === cleanTargetId || eEmail === cleanTargetId)) return true;
      if (targetEmail && eEmail === targetEmail) return true;
      if (targetName && (eName === targetName || (targetName.length >= 3 && eName.includes(targetName)))) return true;
      return false;
    });

    if (index !== -1) {
      // Edit existing employee
      const targetEmp = db.employees[index];
      const userEmailMatch = cookieHeader.match(/hrm_user_email=([^;]+)/);
      const userIdMatch = cookieHeader.match(/hrm_user_id=([^;]+)/);
      const currentEmail = userEmailMatch ? decodeURIComponent(userEmailMatch[1]).toLowerCase() : '';
      const currentId = userIdMatch ? decodeURIComponent(userIdMatch[1]).toLowerCase() : '';

      const isSelf = (currentEmail && targetEmp.email && targetEmp.email.toLowerCase() === currentEmail) ||
                     (currentId && targetEmp.id && targetEmp.id.toLowerCase() === currentId);

      if (!isAdmin && !isSelf) {
        return NextResponse.json({ error: 'Unauthorized. You cannot modify other employee accounts.' }, { status: 403 });
      }

      // Non-admins cannot alter system role or status
      if (!isAdmin) {
        delete body.role;
        delete body.status;
      }

      const oldVal = JSON.stringify(db.employees[index]);
      db.employees[index] = { ...db.employees[index], ...body };
      logAudit('Update Employee', 'Employee', db.employees[index].id, oldVal, JSON.stringify(db.employees[index]));
      saveDbData(db);

      const safeEmployees = isAdmin ? db.employees : db.employees.map(e => {
        const { password, ...rest } = e;
        return rest;
      });

      return NextResponse.json({ success: true, employee: db.employees[index], employees: safeEmployees });
    }

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized. Only admins can register new employees.' }, { status: 403 });
    }

    // Create new employee
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      employeeId: body.employeeId || `EMP${Math.floor(100 + Math.random() * 900)}`,
      name: body.name,
      email: body.email,
      password: body.password || 'Employee@123',
      phone: body.phone || '',
      department: body.department || 'General',
      designation: body.designation || 'Staff',
      dateOfJoining: body.dateOfJoining || new Date().toISOString().split('T')[0],
      role: body.role || 'EMPLOYEE',
      status: body.status || 'ACTIVE',
      workMode: body.workMode || 'OFFICE',
      primaryManager: body.primaryManager || '',
      secondaryManager: body.secondaryManager || '',
      monthlySalary: Number(body.monthlySalary) || 50000,
      dailyWorkingRequirementMinutes: Number(body.dailyWorkingRequirementMinutes) || 480,
      weeklyOff: body.weeklyOff || 'Sunday',
      casualAllowance: Number(body.casualAllowance) || 2,
      plannedAllowance: Number(body.plannedAllowance) || 4,
      sickAllowance: Number(body.sickAllowance) || 4,
      branchId: body.branchId || 'branch-main',
      branch: body.branch || 'Main Branch',
    };

    db.employees.push(newEmp);
    logAudit('Create Employee', 'Employee', newEmp.id, undefined, JSON.stringify(newEmp));
    saveDbData(db);

    return NextResponse.json({ success: true, employee: newEmp, employees: db.employees });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save employee' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, action, status, currentPassword, password } = body;
    const targetEmail = body.email ? body.email.toLowerCase().trim() : '';
    const targetName = body.name ? body.name.toLowerCase().trim() : '';

    const cookieHeader = request.headers.get('cookie') || '';
    const isAdmin = cookieHeader.includes('hrm_user_role=ADMIN');

    const db = getDbData();
    const index = db.employees.findIndex(e => {
      const eId = String(e.id || '').toLowerCase().trim();
      const eEmpId = String(e.employeeId || '').toLowerCase().trim();
      const eEmail = String(e.email || '').toLowerCase().trim();
      const eName = String(e.name || '').toLowerCase().trim();

      const cleanTargetId = String(id || body.employeeId || '').toLowerCase().trim();

      if (cleanTargetId && (eId === cleanTargetId || eEmpId === cleanTargetId || eEmail === cleanTargetId)) return true;
      if (targetEmail && eEmail === targetEmail) return true;
      if (targetName && (eName === targetName || (targetName.length >= 3 && eName.includes(targetName)))) return true;
      return false;
    });

    if (index === -1) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const targetEmp = db.employees[index];
    const userEmailMatch = cookieHeader.match(/hrm_user_email=([^;]+)/);
    const userIdMatch = cookieHeader.match(/hrm_user_id=([^;]+)/);
    const loggedInEmail = userEmailMatch ? decodeURIComponent(userEmailMatch[1]).toLowerCase() : '';
    const loggedInId = userIdMatch ? decodeURIComponent(userIdMatch[1]).toLowerCase() : '';

    const isSelf = (loggedInEmail && targetEmp.email && targetEmp.email.toLowerCase() === loggedInEmail) ||
                   (loggedInId && targetEmp.id && targetEmp.id.toLowerCase() === loggedInId);

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Unauthorized. You cannot modify other employee accounts.' }, { status: 403 });
    }

    // If changing password and currentPassword was provided, verify it on server
    if (password && currentPassword && !isAdmin) {
      const actualCurrentPass = targetEmp.password || 'Employee@123';
      if (currentPassword !== actualCurrentPass) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }
    }

    const oldVal = JSON.stringify(db.employees[index]);

    if (action === 'TOGGLE_STATUS') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized. Only admins can toggle employee status.' }, { status: 403 });
      }
      db.employees[index].status = status || (db.employees[index].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      logAudit(`Status Changed to ${db.employees[index].status}`, 'Employee', db.employees[index].id, oldVal, JSON.stringify(db.employees[index]));
    } else {
      // Non-admins cannot elevate their own role
      if (!isAdmin) {
        delete body.role;
        delete body.status;
      }
      delete body.currentPassword;
      db.employees[index] = { ...db.employees[index], ...body };
      logAudit('Update Employee Profile', 'Employee', db.employees[index].id, oldVal, JSON.stringify(db.employees[index]));
    }

    saveDbData(db);

    const safeEmployees = isAdmin ? db.employees : db.employees.map(e => {
      const { password, ...rest } = e;
      return rest;
    });

    return NextResponse.json({ success: true, employee: db.employees[index], employees: safeEmployees });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const isAdmin = cookieHeader.includes('hrm_user_role=ADMIN');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized. Only admins can delete employees.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
    }

    const db = getDbData();
    const index = db.employees.findIndex(e => e.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const deletedEmp = db.employees[index];
    db.employees.splice(index, 1);
    logAudit('Delete Employee', 'Employee', id, JSON.stringify(deletedEmp), undefined);
    saveDbData(db);

    return NextResponse.json({ success: true, message: `Employee ${deletedEmp.name} deleted successfully`, employees: db.employees });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete employee' }, { status: 500 });
  }
}
