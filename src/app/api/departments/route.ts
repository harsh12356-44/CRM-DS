import { NextResponse } from 'next/server';
import { getDbData, saveDbData, logAudit } from '@/lib/store';

export interface DepartmentItem {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  description?: string;
  employeeCount: number;
}

export async function GET() {
  const db = getDbData();

  if (!db.departments) {
    db.departments = [];
  }

  // Compute base count map and managers map for all employee departments
  const deptsMap = new Map<string, { count: number; managerName?: string }>();
  db.employees.forEach(e => {
    const dept = (e.department || 'General').trim();
    if (!deptsMap.has(dept)) {
      deptsMap.set(dept, { count: 0, managerName: e.primaryManager || e.managerName || 'Ravina Khimani' });
    }
    const curr = deptsMap.get(dept)!;
    curr.count += 1;
    if ((!curr.managerName || curr.managerName === 'Unassigned') && (e.primaryManager || e.managerName)) {
      curr.managerName = e.primaryManager || e.managerName;
    }
  });

  // Ensure initial core departments exist
  const defaultSeeds = [
    { id: 'dept-design', code: 'DSG', name: 'Design', managerName: 'Ravina Khimani', description: 'Graphic & UI/UX Design operations and creative direction.' },
    { id: 'dept-development', code: 'DEV', name: 'Development', managerName: 'Naman Bangia', description: 'Web & Software Engineering Development operations.' },
    { id: 'dept-human-resources', code: 'HR', name: 'Human Resources', managerName: 'Ravina Khimani', description: 'Core Human Resources & People Operations.' },
    { id: 'dept-seo', code: 'SEO', name: 'SEO', managerName: 'Meenal', description: 'Search Engine Optimization and Digital Marketing.' },
    { id: 'dept-engineering', code: 'ENG', name: 'Engineering', managerName: 'Harshit Bhootra', description: 'Core Engineering Department operations.' },
    { id: 'dept-sales', code: 'SAL', name: 'Sales', managerName: 'Rajesh Kumar', description: 'Core Sales Department operations.' },
  ];

  let hasChanged = false;

  defaultSeeds.forEach(seed => {
    const exists = db.departments!.some(d => d.name.toLowerCase().trim() === seed.name.toLowerCase());
    if (!exists) {
      db.departments!.push({
        ...seed,
        employeeCount: deptsMap.get(seed.name)?.count || 0,
      });
      hasChanged = true;
    }
  });

  // Dynamically auto-create ANY missing department found on employee profiles
  deptsMap.forEach((info, deptName) => {
    const exists = db.departments!.some(d => d.name.toLowerCase().trim() === deptName.toLowerCase());
    if (!exists) {
      db.departments!.push({
        id: `dept-${deptName.toLowerCase().replace(/\s+/g, '-')}`,
        code: deptName.substring(0, 3).toUpperCase(),
        name: deptName,
        managerName: info.managerName || 'Ravina Khimani',
        description: `Core ${deptName} Department operations and personnel management.`,
        employeeCount: info.count,
      });
      hasChanged = true;
    }
  });

  if (hasChanged) {
    saveDbData(db);
  }

  // Update employee counts dynamically
  const finalDepts = db.departments.map(d => ({
    ...d,
    employeeCount: deptsMap.get(d.name.trim())?.count || d.employeeCount || 0,
  }));

  return NextResponse.json(finalDepts);
}

export async function POST(request: Request) {
  try {
    const { name, code, managerName, description } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.departments) db.departments = [];

    const newDept: DepartmentItem = {
      id: `dept-${Date.now()}`,
      code: code || name.substring(0, 3).toUpperCase(),
      name,
      managerName: managerName || 'Unassigned',
      description: description || `Custom ${name} Department.`,
      employeeCount: 0,
    };

    db.departments.push(newDept);
    saveDbData(db);

    logAudit('Create Department', 'Department', newDept.code, undefined, newDept.name);

    return NextResponse.json({
      success: true,
      department: newDept,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error creating department' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, name, code, managerName, description } = await request.json();

    const db = getDbData();
    if (!db.departments) db.departments = [];

    const index = db.departments.findIndex(d => d.id === id);

    if (index !== -1) {
      const oldVal = JSON.stringify(db.departments[index]);
      db.departments[index] = {
        ...db.departments[index],
        name: name || db.departments[index].name,
        code: code || db.departments[index].code,
        managerName: managerName || db.departments[index].managerName,
        description: description || db.departments[index].description,
      };

      logAudit('Update Department Structure', 'Department', id, oldVal, JSON.stringify(db.departments[index]));
      saveDbData(db);
      return NextResponse.json({ success: true, department: db.departments[index], departments: db.departments });
    }

    return NextResponse.json({ error: 'Department not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating department' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.departments) db.departments = [];

    const index = db.departments.findIndex(d => d.id === id);

    if (index !== -1) {
      const deletedDept = db.departments[index];
      db.departments.splice(index, 1);
      logAudit('Delete Department', 'Department', id, JSON.stringify(deletedDept), undefined);
      saveDbData(db);
      return NextResponse.json({ success: true, message: `Department ${deletedDept.name} deleted`, departments: db.departments });
    }

    return NextResponse.json({ error: 'Department not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting department' }, { status: 500 });
  }
}
