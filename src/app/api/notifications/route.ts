import { NextResponse } from 'next/server';
import { getDbData, saveDbData } from '@/lib/store';

export async function GET() {
  const db = getDbData();
  return NextResponse.json(db.notifications || []);
}

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    const db = getDbData();
    const index = (db.notifications || []).findIndex(n => n.id === id);
    if (index !== -1) {
      db.notifications[index].isRead = true;
      saveDbData(db);
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating notification' }, { status: 500 });
  }
}
