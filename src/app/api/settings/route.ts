import { NextResponse } from 'next/server';
import { getDbData, saveDbData } from '@/lib/store';

export async function GET() {
  const db = getDbData();
  return NextResponse.json(db.settings);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getDbData();
    db.settings = { ...db.settings, ...body };
    saveDbData(db);
    return NextResponse.json({ success: true, settings: db.settings });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
