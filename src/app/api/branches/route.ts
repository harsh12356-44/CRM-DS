import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, logAudit } from '@/lib/store';
import { Branch, DEFAULT_BRANCHES } from '@/lib/types';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const db = getDbData();
    if (!db.branches || db.branches.length === 0) {
      db.branches = DEFAULT_BRANCHES.map(b => ({ ...b }));
      await saveDbDataAsync(db);
    }

    // Calculate active employee counts per branch
    const branchCounts = new Map<string, number>();
    db.employees.forEach(emp => {
      if ((emp.status || 'ACTIVE') !== 'INACTIVE') {
        const bId = emp.branchId || 'branch-main';
        branchCounts.set(bId, (branchCounts.get(bId) || 0) + 1);
      }
    });

    const branchesWithCounts: Branch[] = db.branches.map(b => ({
      ...b,
      employeeCount: branchCounts.get(b.id) || 0,
    }));

    return NextResponse.json(branchesWithCounts, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to load branches.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, dailyWorkingRequirementMinutes, weeklyOff, address, isDefault } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Branch name is required.' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.branches) db.branches = DEFAULT_BRANCHES.map(b => ({ ...b }));

    const cleanName = name.trim();
    const cleanCode = (code || cleanName.slice(0, 4)).toUpperCase().trim();

    if (db.branches.some(b => b.name.toLowerCase() === cleanName.toLowerCase())) {
      return NextResponse.json({ error: 'A branch with this name already exists.' }, { status: 409 });
    }

    if (isDefault) {
      db.branches.forEach(b => { b.isDefault = false; });
    }

    const newBranch: Branch = {
      id: `branch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      code: cleanCode,
      dailyWorkingRequirementMinutes: Number(dailyWorkingRequirementMinutes) === 480 ? 480 : 420,
      weeklyOff: String(weeklyOff || 'Sunday'),
      address: address ? String(address).trim() : undefined,
      isDefault: Boolean(isDefault),
      createdAt: new Date().toISOString(),
    };

    db.branches.push(newBranch);
    await saveDbDataAsync(db);

    logAudit('CREATE_BRANCH', 'Branch', newBranch.id, undefined, cleanName);

    return NextResponse.json({ success: true, branch: newBranch }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create branch.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, code, dailyWorkingRequirementMinutes, weeklyOff, address, isDefault } = body;

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required.' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.branches) db.branches = DEFAULT_BRANCHES.map(b => ({ ...b }));

    const branch = db.branches.find(b => b.id === id);
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found.' }, { status: 404 });
    }

    if (name) branch.name = String(name).trim();
    if (code) branch.code = String(code).toUpperCase().trim();
    if (dailyWorkingRequirementMinutes !== undefined) {
      branch.dailyWorkingRequirementMinutes = Number(dailyWorkingRequirementMinutes) === 480 ? 480 : 420;
    }
    if (weeklyOff !== undefined) {
      branch.weeklyOff = String(weeklyOff);
    }
    if (address !== undefined) {
      branch.address = String(address).trim();
    }
    if (isDefault) {
      db.branches.forEach(b => { b.isDefault = b.id === id; });
    }

    // Keep employee branch labels updated
    db.employees.forEach(emp => {
      if (emp.branchId === id) {
        emp.branch = branch.name;
      }
    });

    await saveDbDataAsync(db);
    logAudit('UPDATE_BRANCH', 'Branch', id, undefined, branch.name);

    return NextResponse.json({ success: true, branch }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update branch.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Branch ID is required.' }, { status: 400 });
    }

    const db = getDbData();
    if (!db.branches) db.branches = DEFAULT_BRANCHES.map(b => ({ ...b }));

    const branch = db.branches.find(b => b.id === id);
    if (!branch) {
      return NextResponse.json({ error: 'Branch not found.' }, { status: 404 });
    }

    if (branch.isDefault || branch.id === 'branch-main') {
      return NextResponse.json({ error: 'Cannot delete the main default branch.' }, { status: 400 });
    }

    // Check if employees are assigned to this branch
    const assignedCount = db.employees.filter(e => (e.branchId || 'branch-main') === id).length;
    if (assignedCount > 0) {
      return NextResponse.json({
        error: `Cannot delete branch with ${assignedCount} active employee(s). Reassign them first.`,
      }, { status: 409 });
    }

    db.branches = db.branches.filter(b => b.id !== id);
    await saveDbDataAsync(db);

    logAudit('DELETE_BRANCH', 'Branch', id, branch.name, undefined);

    return NextResponse.json({ success: true, message: `Branch "${branch.name}" deleted.` }, { headers: NO_CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete branch.' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
