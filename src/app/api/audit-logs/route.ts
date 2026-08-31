import { NextResponse } from 'next/server';
import { getDbData } from '@/lib/store';

export async function GET() {
  const db = getDbData();
  return NextResponse.json(db.auditLogs);
}
