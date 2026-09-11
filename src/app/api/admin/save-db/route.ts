import { NextResponse } from 'next/server';
import { getDbData, saveDbData } from '@/lib/store';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    const db = getDbData();
    
    // Ensure backups directory exists
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate timestamped backup file name
    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-');
    const backupFileName = `db_backup_${timestampStr}.json`;
    const backupPath = path.join(backupDir, backupFileName);

    // Save current db state to backup file
    fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), 'utf-8');

    // Force flush to data/db.json
    await saveDbDataAsync(db);

    const stats = {
      employees: db.employees?.length || 0,
      leaveRecords: db.leaveRecords?.length || 0,
      attendanceLogs: db.attendanceLogs?.length || 0,
      holidays: db.holidays?.length || 0,
    };

    return NextResponse.json({
      success: true,
      message: 'Database saved and backed up successfully',
      timestamp: now.toISOString(),
      backupFile: backupFileName,
      stats,
    });
  } catch (error: any) {
    console.error('Error saving database:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save database' },
      { status: 500 }
    );
  }
}
