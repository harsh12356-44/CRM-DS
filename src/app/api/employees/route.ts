export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbData, logAudit } from '@/lib/store';
import { Employee } from '@/lib/types';

export async function GET() {
  const db = getDbData();
  return NextResponse.json(db.employees);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDbData();

    if (body.id) {
      // Edit existing employee
      const index = db.employees.findIndex(e => e.id === body.id);
      if (index !== -1) {
        const oldVal = JSON.stringify(db.employees[index]);
        db.employees[index] = { ...db.employees[index], ...body };
        logAudit('Update Employee', 'Employee', body.id, oldVal, JSON.stringify(db.employees[index]));
        saveDbData(db);
        return NextResponse.json({ success: true, employee: db.employees[index] });
      }
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
    };

    db.employees.push(newEmp);
    logAudit('Create Employee', 'Employee', newEmp.id, undefined, JSON.stringify(newEmp));
    saveDbData(db);

    return NextResponse.json({ success: true, employee: newEmp });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save employee' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, action, status } = body;

    const db = getDbData();
    const index = db.employees.findIndex(e => e.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const oldVal = JSON.stringify(db.employees[index]);

    if (action === 'TOGGLE_STATUS') {
      db.employees[index].status = status || (db.employees[index].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      logAudit(`Status Changed to ${db.employees[index].status}`, 'Employee', id, oldVal, JSON.stringify(db.employees[index]));
    } else {
      db.employees[index] = { ...db.employees[index], ...body };
      logAudit('Update Employee Profile', 'Employee', id, oldVal, JSON.stringify(db.employees[index]));
    }

    saveDbData(db);
    return NextResponse.json({ success: true, employee: db.employees[index], employees: db.employees });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
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
