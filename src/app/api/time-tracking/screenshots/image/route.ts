export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDbData, ensureCloudSync } from '@/lib/store';
import { getRequestUser, findRequestEmployee, canViewEmployee } from '@/lib/requestUser';
import { readScreenshotImage } from '@/lib/screenshotStore';

// GET ?employeeId=&date=&id=&thumb=1 — streams one screenshot after a permission check.
export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user.role) return new NextResponse('Unauthorized', { status: 401 });
  await ensureCloudSync();
  const url = new URL(request.url);
  const db = getDbData();
  const empParam = String(url.searchParams.get('employeeId') || '').trim();
  const emp = db.employees.find(e => e.id === empParam || e.employeeId === empParam);
  if (!emp) return new NextResponse('Not found', { status: 404 });
  if (!canViewEmployee(user, findRequestEmployee(user, db.employees), emp)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  const image = readScreenshotImage(emp.id, url.searchParams.get('date') || '', url.searchParams.get('id') || '', url.searchParams.get('thumb') === '1');
  if (!image) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(image.length),
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
