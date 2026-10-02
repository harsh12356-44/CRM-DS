export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, logAudit } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.email || body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!identifier) {
      return NextResponse.json({ success: false, error: 'Email or Employee ID is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });
    }

    const db = getDbData();
    const cleanPrefix = identifier.split('@')[0];

    // Find employee by email, employee ID, username prefix, or name
    const emp = db.employees.find(e => {
      if (!e) return false;
      const eEmail = (e.email || '').toLowerCase().trim();
      const ePrefix = eEmail.split('@')[0];
      const eCode = (e.employeeId || '').toLowerCase().trim();
      const eName = (e.name || '').toLowerCase().trim();

      return (
        eEmail === identifier ||
        (ePrefix && ePrefix === identifier) ||
        (ePrefix && cleanPrefix && ePrefix === cleanPrefix) ||
        (eCode && (eCode === identifier || eCode === cleanPrefix)) ||
        (eName && (eName === identifier || eName === cleanPrefix || identifier.includes(eName) || eName.includes(cleanPrefix))) ||
        (identifier.length > 2 && eEmail.startsWith(identifier))
      );
    });

    if (!emp) {
      return NextResponse.json({ success: false, error: 'Account not found. Please check your email or employee ID.' }, { status: 404 });
    }

    // Determine expected password
    const expectedPassword = emp.password || (emp.role === 'ADMIN' ? 'Admin@123' : emp.role === 'MANAGER' ? 'Manager@123' : 'Employee@123');

    if (password !== expectedPassword) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid password for ${emp.name || identifier}. Please check your credentials.` 
      }, { status: 401 });
    }

    // Role and Employee details
    const targetRole = (emp.role as 'ADMIN' | 'MANAGER' | 'EMPLOYEE') || 'EMPLOYEE';
    const safeEmployee = {
      id: emp.id,
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      role: targetRole,
      department: emp.department || 'General',
      designation: emp.designation || 'Staff',
      status: emp.status || 'ACTIVE',
    };

    logAudit('User Login', 'Auth', emp.id, undefined, `User ${emp.name} (${emp.email}) signed in successfully`);

    const response = NextResponse.json({
      success: true,
      employee: safeEmployee,
    });

    // Set secure authentication cookies
    response.cookies.set('hrm_user_role', targetRole, {
      path: '/',
      maxAge: 86400 * 30, // 30 days
      sameSite: 'lax',
    });
    response.cookies.set('hrm_user_email', emp.email, {
      path: '/',
      maxAge: 86400 * 30,
      sameSite: 'lax',
    });
    response.cookies.set('hrm_user_id', emp.id, {
      path: '/',
      maxAge: 86400 * 30,
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Authentication failed.' }, { status: 500 });
  }
}
