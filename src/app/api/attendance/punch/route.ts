import { NextResponse } from 'next/server';
import { getDbData, saveDbData } from '@/lib/store';
import { AttendanceLog } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { employeeId, action } = await request.json(); // action: 'IN' | 'OUT'
    const db = getDbData();

    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour12: false });

    let existingLog = db.attendanceLogs.find(
      log => log.employeeId === employeeId && log.date === today
    );

    if (action === 'IN') {
      if (existingLog && !existingLog.checkOut) {
        return NextResponse.json({ message: 'Already punched in today', log: existingLog });
      }

      const newLog: AttendanceLog = {
        id: `att-${Date.now()}`,
        employeeId,
        date: today,
        attendanceCode: 'P',
        checkIn: nowTime,
        workedMinutes: 0,
        requiredMinutes: 480,
        shortMinutes: 480,
        extraMinutes: 0,
        sundayWorkedMinutes: 0,
        location: 'Office Main Gate',
      };

      db.attendanceLogs.push(newLog);
      saveDbData(db);
      return NextResponse.json({ success: true, action: 'PUNCH_IN', log: newLog });
    } else {
      if (!existingLog) {
        return NextResponse.json({ error: 'Cannot Punch Out without Punching In first' }, { status: 400 });
      }

      existingLog.checkOut = nowTime;
      // Calculate worked minutes
      const inParts = (existingLog.checkIn || nowTime).split(':').map(Number);
      const outParts = nowTime.split(':').map(Number);
      const inMins = inParts[0] * 60 + inParts[1];
      const outMins = outParts[0] * 60 + outParts[1];
      const rawMins = Math.max(0, outMins - inMins);
      const breakMins = db.settings.lunchBreakMinutes || 60;
      const workedMins = Math.max(0, rawMins - breakMins);

      existingLog.workedMinutes = workedMins;
      existingLog.shortMinutes = Math.max(0, 480 - workedMins);
      existingLog.extraMinutes = Math.max(0, workedMins - 480);

      saveDbData(db);
      return NextResponse.json({ success: true, action: 'PUNCH_OUT', log: existingLog });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Punch action failed' }, { status: 500 });
  }
}
