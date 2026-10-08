export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getDbData, saveDbDataAsync, ensureCloudSync } from '@/lib/store';

export async function GET() {
  await ensureCloudSync();
  const db = getDbData();
  return NextResponse.json(db.settings, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}

export async function POST(request: Request) {
  try {
    await ensureCloudSync();
    const body = await request.json();
    const db = getDbData();
    db.settings = { ...db.settings, ...body };
    await saveDbDataAsync(db);
    return NextResponse.json({ success: true, settings: db.settings }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
