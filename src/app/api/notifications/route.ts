export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbData } from '@/lib/store';
import { NotificationItem } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = (searchParams.get('userId') || searchParams.get('employeeId') || '').trim().toLowerCase();
    const role = (searchParams.get('role') || '').trim().toUpperCase();
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const db = getDbData();
    const allNotifications: NotificationItem[] = db.notifications || [];

    if (!userId && !role) {
      return NextResponse.json(allNotifications.slice(0, limit), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      });
    }

    // Resolve employee object if possible
    const emp = db.employees.find(
      e => (e.id && e.id.toLowerCase() === userId) ||
           (e.employeeId && e.employeeId.toLowerCase() === userId) ||
           (e.email && e.email.toLowerCase() === userId)
    );

    const targetEmpId = emp ? emp.id.toLowerCase() : userId;
    const targetEmpCode = emp ? (emp.employeeId || '').toLowerCase() : '';
    const effectiveRole = role || (emp ? emp.role : 'EMPLOYEE');

    const filtered = allNotifications.filter(n => {
      const notifEmpId = String(n.employeeId || '').toLowerCase().trim();

      // System-wide broadcasts
      if (notifEmpId === 'all' || notifEmpId === '*' || !notifEmpId) {
        return true;
      }

      // Direct match by ID or employee code
      if (notifEmpId === targetEmpId || (targetEmpCode && notifEmpId === targetEmpCode)) {
        return true;
      }

      // Admin role matches
      if (effectiveRole === 'ADMIN' || effectiveRole === 'SUPER_ADMIN') {
        if (notifEmpId === 'admin' || notifEmpId === 'super_admin' || notifEmpId === 'all_admins') {
          return true;
        }
        if (n.type && (n.type.includes('admin') || n.type === 'leave_applied_admin' || n.type === 'leave_status_updated_admin')) {
          return true;
        }
      }

      // Manager role matches
      if (effectiveRole === 'MANAGER') {
        if (notifEmpId === 'manager' || notifEmpId === 'all_managers') {
          return true;
        }
        if (n.type && (n.type.includes('manager') || n.type === 'leave_applied_manager' || n.type === 'leave_status_updated_manager')) {
          // If explicitly assigned to this manager's ID, it already matched above
          return notifEmpId === targetEmpId || notifEmpId === targetEmpCode || notifEmpId === 'manager';
        }
      }

      return false;
    });

    return NextResponse.json(filtered.slice(0, limit), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching notifications' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, markAll, userId, role } = body;
    const db = getDbData();
    if (!db.notifications) db.notifications = [];

    if (markAll) {
      if (userId || role) {
        const cleanUserId = (userId || '').trim().toLowerCase();
        const cleanRole = (role || '').trim().toUpperCase();
        db.notifications = db.notifications.map(n => {
          const nEmp = String(n.employeeId || '').toLowerCase().trim();
          const matches =
            !cleanUserId ||
            nEmp === cleanUserId ||
            nEmp === 'all' ||
            ((cleanRole === 'ADMIN' || cleanRole === 'SUPER_ADMIN') && (nEmp === 'admin' || n.type?.includes('admin'))) ||
            (cleanRole === 'MANAGER' && (nEmp === 'manager' || n.type?.includes('manager')));
          return matches ? { ...n, isRead: true } : n;
        });
      } else {
        db.notifications = db.notifications.map(n => ({ ...n, isRead: true }));
      }
      saveDbData(db);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (id) {
      const index = db.notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        db.notifications[index].isRead = true;
        saveDbData(db);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Missing id or markAll parameter' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating notification' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = getDbData();
    if (!db.notifications) db.notifications = [];

    if (id) {
      db.notifications = db.notifications.filter(n => n.id !== id);
      saveDbData(db);
      return NextResponse.json({ success: true, message: `Notification ${id} deleted` });
    }

    return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting notification' }, { status: 500 });
  }
}
