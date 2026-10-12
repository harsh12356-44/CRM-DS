export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, logAudit } from '@/lib/store';
import { Company, DEFAULT_COMPANIES, Branch, Employee } from '@/lib/types';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const db = getDbData();
    if (!db.companies || db.companies.length === 0) {
      db.companies = DEFAULT_COMPANIES.map(c => ({ ...c }));
      await saveDbDataAsync(db);
    }

    // Compute employee counts per company
    const employeeCounts = new Map<string, number>();
    db.employees.forEach(emp => {
      if ((emp.status || 'ACTIVE') !== 'INACTIVE') {
        const cId = emp.companyId || 'company-main';
        employeeCounts.set(cId, (employeeCounts.get(cId) || 0) + 1);
      }
    });

    // Compute branch counts per company
    const branchCounts = new Map<string, number>();
    (db.branches || []).forEach(b => {
      const cId = b.companyId || 'company-main';
      branchCounts.set(cId, (branchCounts.get(cId) || 0) + 1);
    });

    const companiesWithMeta: Company[] = db.companies.map(c => ({
      ...c,
      employeeCount: employeeCounts.get(c.id) || 0,
      branchesCount: branchCounts.get(c.id) || 0,
    }));

    return NextResponse.json(companiesWithMeta, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load companies.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      code,
      slug,
      logoUrl,
      contactEmail,
      contactPhone,
      shiftStartTime,
      lunchBreakMinutes,
      dailyWorkingRequirementMinutes,
      weeklyOff,
      adminName,
      adminEmail,
      adminPassword,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.companies) db.companies = DEFAULT_COMPANIES.map(c => ({ ...c }));

    const cleanName = name.trim();
    const cleanCode = (code || cleanName.slice(0, 3)).toUpperCase().trim();
    const cleanSlug = (slug || cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();

    if (db.companies.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      return NextResponse.json({ error: 'A company with this name already exists.' }, { status: 409 });
    }

    if (db.companies.some(c => c.code.toLowerCase() === cleanCode.toLowerCase())) {
      return NextResponse.json({ error: 'A company with this code already exists.' }, { status: 409 });
    }

    const companyId = `company-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newCompany: Company = {
      id: companyId,
      name: cleanName,
      code: cleanCode,
      slug: cleanSlug,
      logoUrl: logoUrl ? String(logoUrl).trim() : '',
      status: 'ACTIVE',
      contactEmail: contactEmail ? String(contactEmail).trim() : undefined,
      contactPhone: contactPhone ? String(contactPhone).trim() : undefined,
      shiftStartTime: shiftStartTime || '09:00',
      lunchBreakMinutes: Number(lunchBreakMinutes) || 60,
      dailyWorkingRequirementMinutes: Number(dailyWorkingRequirementMinutes) === 420 ? 420 : 480,
      weeklyOff: String(weeklyOff || 'Sunday'),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    db.companies.push(newCompany);

    // Automatically create a default HQ branch for this company
    if (!db.branches) db.branches = [];
    const defaultBranch: Branch = {
      id: `branch-${Date.now()}-hq`,
      name: `${cleanName} HQ`,
      code: `${cleanCode}-HQ`,
      companyId: companyId,
      dailyWorkingRequirementMinutes: newCompany.dailyWorkingRequirementMinutes || 480,
      weeklyOff: newCompany.weeklyOff || 'Sunday',
      isDefault: true,
      createdAt: new Date().toISOString(),
    };
    db.branches.push(defaultBranch);

    // Optionally create the company's primary Admin employee
    if (adminEmail && adminName) {
      const cleanAdminEmail = String(adminEmail).toLowerCase().trim();
      const newAdminEmp: Employee = {
        id: `emp-${Date.now()}`,
        employeeId: `${cleanCode}001`,
        name: String(adminName).trim(),
        email: cleanAdminEmail,
        password: adminPassword ? String(adminPassword).trim() : 'Admin@123',
        department: 'Management',
        designation: 'Company Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        companyId: companyId,
        companyName: cleanName,
        branchId: defaultBranch.id,
        branch: defaultBranch.name,
        monthlySalary: 75000,
        dailyWorkingRequirementMinutes: newCompany.dailyWorkingRequirementMinutes || 480,
        weeklyOff: newCompany.weeklyOff || 'Sunday',
        casualAllowance: 2,
        plannedAllowance: 4,
        sickAllowance: 4,
        dateOfJoining: new Date().toISOString().split('T')[0],
      };
      db.employees.push(newAdminEmp);
    }

    await saveDbDataAsync(db);
    logAudit('CREATE_COMPANY', 'Company', newCompany.id, undefined, cleanName);

    return NextResponse.json({ success: true, company: newCompany }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create company.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      code,
      slug,
      logoUrl,
      contactEmail,
      contactPhone,
      shiftStartTime,
      lunchBreakMinutes,
      dailyWorkingRequirementMinutes,
      weeklyOff,
      status,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.companies) db.companies = DEFAULT_COMPANIES.map(c => ({ ...c }));

    const compIndex = db.companies.findIndex(c => c.id === id);
    if (compIndex === -1) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    const oldCompany = db.companies[compIndex];
    const cleanName = name ? String(name).trim() : oldCompany.name;
    const cleanCode = code ? String(code).toUpperCase().trim() : oldCompany.code;

    // Check duplicate name if renamed
    if (cleanName.toLowerCase() !== oldCompany.name.toLowerCase()) {
      if (db.companies.some(c => c.id !== id && c.name.toLowerCase() === cleanName.toLowerCase())) {
        return NextResponse.json({ error: 'Another company already uses this name.' }, { status: 409 });
      }
    }

    const updatedCompany: Company = {
      ...oldCompany,
      name: cleanName,
      code: cleanCode,
      slug: slug ? String(slug).trim() : oldCompany.slug,
      logoUrl: logoUrl !== undefined ? String(logoUrl).trim() : oldCompany.logoUrl,
      contactEmail: contactEmail !== undefined ? String(contactEmail).trim() : oldCompany.contactEmail,
      contactPhone: contactPhone !== undefined ? String(contactPhone).trim() : oldCompany.contactPhone,
      shiftStartTime: shiftStartTime || oldCompany.shiftStartTime || '09:00',
      lunchBreakMinutes: lunchBreakMinutes ? Number(lunchBreakMinutes) : oldCompany.lunchBreakMinutes,
      dailyWorkingRequirementMinutes: dailyWorkingRequirementMinutes ? Number(dailyWorkingRequirementMinutes) : oldCompany.dailyWorkingRequirementMinutes,
      weeklyOff: weeklyOff || oldCompany.weeklyOff || 'Sunday',
      status: status ? (status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE') : oldCompany.status,
    };

    db.companies[compIndex] = updatedCompany;

    // Sync companyName across employees if renamed
    if (cleanName !== oldCompany.name) {
      db.employees.forEach(emp => {
        if (emp.companyId === id) {
          emp.companyName = cleanName;
        }
      });
    }

    await saveDbDataAsync(db);
    logAudit('UPDATE_COMPANY', 'Company', id, JSON.stringify(oldCompany), JSON.stringify(updatedCompany));

    return NextResponse.json({ success: true, company: updatedCompany }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update company.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.companies) db.companies = DEFAULT_COMPANIES.map(c => ({ ...c }));

    const compIndex = db.companies.findIndex(c => c.id === id);
    if (compIndex === -1) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
    }

    const targetCompany = db.companies[compIndex];

    // Protection 1: Primary default company cannot be deleted
    if (targetCompany.isDefault || targetCompany.id === 'company-main') {
      return NextResponse.json({ error: 'The primary default company space cannot be deleted.' }, { status: 403 });
    }

    // Protection 2: Cannot delete company with assigned staff
    const assignedStaffCount = db.employees.filter(e => e.companyId === id && (e.status || 'ACTIVE') !== 'INACTIVE').length;
    if (assignedStaffCount > 0) {
      return NextResponse.json({
        error: `Cannot delete "${targetCompany.name}". It currently has ${assignedStaffCount} active staff assigned. Please reassign staff before deleting.`,
      }, { status: 409 });
    }

    db.companies.splice(compIndex, 1);
    await saveDbDataAsync(db);
    logAudit('DELETE_COMPANY', 'Company', id, JSON.stringify(targetCompany), undefined);

    return NextResponse.json({ success: true, message: `Company "${targetCompany.name}" deleted successfully.` }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete company.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
