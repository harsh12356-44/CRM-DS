import { Employee, AttendanceLog } from './types';

export interface ParsedPunchResult {
  checkIn: string;
  checkOut: string;
  workedMinutes: number;
  attendanceCode: 'P' | 'A' | 'HD' | 'WO' | 'WO-I' | 'MP' | string;
}

export function parsePunchTimes(cellVal: any): ParsedPunchResult {
  if (cellVal === null || cellVal === undefined) {
    return { checkIn: '', checkOut: '', workedMinutes: 0, attendanceCode: 'A' };
  }

  // Convert number / float Excel time fraction (e.g. 0.3854 = 09:15)
  if (typeof cellVal === 'number') {
    if (cellVal > 0 && cellVal < 1) {
      const totalMins = Math.round(cellVal * 24 * 60);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return { checkIn: formatted, checkOut: '', workedMinutes: 0, attendanceCode: 'MP' };
    }
  }

  const origText = String(cellVal).trim();
  if (!origText || origText === 'NA' || origText === '-') {
    return { checkIn: '', checkOut: '', workedMinutes: 0, attendanceCode: 'A' };
  }

  const upperText = origText.toUpperCase();

  if (upperText === 'WO-I' || upperText === 'WO' || upperText === 'WEEKLY OFF') {
    return { checkIn: '', checkOut: '', workedMinutes: 0, attendanceCode: 'WO-I' };
  }
  if (upperText === 'A' || upperText === 'ABSENT') {
    return { checkIn: '', checkOut: '', workedMinutes: 0, attendanceCode: 'A' };
  }
  if (upperText === 'HD' || upperText === 'HALF DAY' || upperText === 'HALF-DAY') {
    return { checkIn: '09:00', checkOut: '13:00', workedMinutes: 240, attendanceCode: 'HD' };
  }
  if (['PL', 'CL', 'SL', 'UL'].includes(upperText)) {
    return { checkIn: '', checkOut: '', workedMinutes: 0, attendanceCode: upperText };
  }

  // Clean status prefixes like "P ", "PRESENT ", "P\n", "P ("
  let cleanedText = origText
    .replace(/^P\s*\((.*?)\)$/i, '$1')
    .replace(/^(P|PRESENT)\s*[\n\t\s:\-]*/i, '')
    .trim();

  if (!cleanedText && (upperText.startsWith('P') || upperText === 'PRESENT')) {
    return { checkIn: '09:00', checkOut: '18:00', workedMinutes: 480, attendanceCode: 'P' };
  }

  // Regex to capture HH:mm or HH:mm:ss with optional AM/PM
  const timeRegex = /\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?\s*(AM|PM|am|pm)?\b/g;
  const matches = Array.from((cleanedText || origText).matchAll(timeRegex));

  if (matches.length >= 2) {
    const firstMatch = matches[0];
    const lastMatch = matches[matches.length - 1];

    let inH = parseInt(firstMatch[1], 10);
    const inM = parseInt(firstMatch[2], 10);
    const inAmPm = firstMatch[4] ? firstMatch[4].toUpperCase() : null;

    if (inAmPm === 'PM' && inH < 12) inH += 12;
    if (inAmPm === 'AM' && inH === 12) inH = 0;

    let outH = parseInt(lastMatch[1], 10);
    const outM = parseInt(lastMatch[2], 10);
    const outAmPm = lastMatch[4] ? lastMatch[4].toUpperCase() : null;

    if (outAmPm === 'PM' && outH < 12) outH += 12;
    if (outAmPm === 'AM' && outH === 12) outH = 0;

    // Auto 12-hour rollover conversion if AM/PM was omitted (e.g. CheckIn: 09:15, CheckOut: 06:30)
    if (!outAmPm && outH < inH && outH < 12) {
      outH += 12;
    }

    const checkIn = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`;
    const checkOut = `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;

    const totalInMins = inH * 60 + inM;
    const totalOutMins = outH * 60 + outM;
    const workedMinutes = Math.max(0, totalOutMins - totalInMins);

    return {
      checkIn,
      checkOut,
      workedMinutes,
      attendanceCode: workedMinutes > 0 ? 'P' : 'A',
    };
  }

  if (matches.length === 1) {
    const match = matches[0];
    let inH = parseInt(match[1], 10);
    const inM = parseInt(match[2], 10);
    const inAmPm = match[4] ? match[4].toUpperCase() : null;

    if (inAmPm === 'PM' && inH < 12) inH += 12;
    if (inAmPm === 'AM' && inH === 12) inH = 0;

    const checkIn = `${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}`;
    return {
      checkIn,
      checkOut: '',
      workedMinutes: 0,
      attendanceCode: 'MP',
    };
  }

  // Fallback for plain "P" or unparsed non-empty string
  if (upperText === 'P' || upperText.startsWith('P') || upperText === 'PRESENT') {
    return { checkIn: '09:00', checkOut: '18:00', workedMinutes: 480, attendanceCode: 'P' };
  }

  return { checkIn: '', checkOut: '', workedMinutes: 0, attendanceCode: 'A' };
}

export function parseBiometricPunches(rawData: any[], employees: Employee[], monthYear: string = '2026-07'): AttendanceLog[] {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const logs: AttendanceLog[] = [];

  // Robust Matcher prioritizing Employee Name across all row cells
  function matchEmployeeByNameOrCode(rowCells: string[]): Employee | undefined {
    if (!Array.isArray(rowCells) || rowCells.length === 0) return undefined;

    const cleanCells = rowCells.map(c => String(c || '').trim()).filter(Boolean);

    for (const cell of cleanCells) {
      const normCell = cell.toLowerCase().trim();
      if (!normCell || normCell.length < 2) continue;

      // Filter out header words, labels, status terms, and pure numbers
      if (['generated', 'total', 'summary', 'present', 'absent', 'weekly', 'department', 'designation', 'status', 'code', 'name', 's.no', 'sno', 'sl.no', 'slno', 'date', 'hours', 'time', 'shift', 'page'].some(k => normCell.includes(k))) continue;

      // 1. Direct Employee ID / System Code Match (e.g. RK001, NB002, emp-1, LG008, BB011, SG012)
      for (const emp of employees) {
        if (emp.id.toLowerCase() === normCell || emp.employeeId.toLowerCase() === normCell) {
          return emp;
        }
      }

      // 2. Name Matching
      const inputParts = normCell.split(/[\s,._\-]+/).filter(Boolean);
      const inputFirstName = inputParts[0] || '';

      for (const emp of employees) {
        const normName = emp.name.toLowerCase().trim();
        const sysParts = normName.split(/[\s,._\-]+/).filter(Boolean);
        const sysFirstName = sysParts[0] || '';

        // Exact full name match (e.g. "Ravina Khimani" === "ravina khimani")
        if (normName === normCell) return emp;

        // First Name match (e.g. "Lochita", "Bulbul", "Sonu", "Naman", "Ravina", "Jigyasa", "Divyanshu", "Meenal", "Anup", "Rajvardhan", "Mudita", "Shweta", "Charubhati", "Shryanshu", "Garv", "Charu")
        if (inputFirstName && inputFirstName.length >= 3 && sysFirstName === inputFirstName) {
          return emp;
        }

        // Full name parts match (e.g. "Ravina K" or "Khimani Ravina" or "Sonu G")
        if (inputParts.length >= 2 && sysParts.length >= 2) {
          if (sysParts.some(p => inputParts.includes(p)) && (sysParts[0] === inputParts[0] || sysParts[sysParts.length - 1] === inputParts[inputParts.length - 1])) {
            return emp;
          }
        }
      }
    }

    return undefined;
  }

  // Helper to dynamically extract cell value for day numbers 1..31 from row object
  function getCellForDay(rowObj: any, rowKeys: string[], dayNum: number) {
    const dayStr = String(dayNum);
    const padDayStr = String(dayNum).padStart(2, '0');

    const matchedKey = rowKeys.find(k => {
      const cleanK = k.trim().toLowerCase();
      if (cleanK === dayStr || cleanK === padDayStr) return true;
      if (cleanK === `day ${dayStr}` || cleanK === `day ${padDayStr}`) return true;
      if (cleanK === `day${dayStr}` || cleanK === `day${padDayStr}`) return true;
      const numVal = parseInt(cleanK, 10);
      return !isNaN(numVal) && numVal === dayNum && String(numVal) === cleanK;
    });

    return matchedKey ? rowObj[matchedKey] : undefined;
  }

  // 1. Process 2D Array Matrix (ONtime / Secureye / ESSL 2D exports)
  if (Array.isArray(rawData[0])) {
    let headerRowIdx = -1;
    const dayColumns: { [day: number]: number } = {};

    for (let r = 0; r < rawData.length; r++) {
      const row = rawData[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => String(c).toLowerCase()).join(' ');

      const dayCount = row.filter((cell: any) => {
        const valStr = String(cell || '').trim();
        const num = parseInt(valStr, 10);
        return !isNaN(num) && num >= 1 && num <= 31 && valStr === String(num);
      }).length;

      if (dayCount >= 5 || rowStr.includes('emp code') || rowStr.includes('emp name') || rowStr.includes('employee') || rowStr.includes('code') || rowStr.includes('id')) {
        headerRowIdx = r;
        row.forEach((cell: any, colIdx: number) => {
          if (cell !== null && cell !== undefined) {
            const valStr = String(cell).trim();
            const num = parseInt(valStr, 10);
            if (!isNaN(num) && num >= 1 && num <= 31 && valStr === String(num)) {
              dayColumns[num] = colIdx;
            }
          }
        });
        if (Object.keys(dayColumns).length >= 5) break;
      }
    }

    if (headerRowIdx !== -1) {
      for (let r = headerRowIdx + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!Array.isArray(row) || row.length < 2) continue;

        const rowTextCells = row.slice(0, 8).map(c => String(c || '').trim());
        const matchedEmp = matchEmployeeByNameOrCode(rowTextCells);

        if (!matchedEmp) continue;

        Object.keys(dayColumns).forEach(dayKey => {
          const dayNum = Number(dayKey);
          const colIdx = dayColumns[dayNum];
          const cellVal = row[colIdx];
          if (cellVal === null || cellVal === undefined) return;

          const dayStr = String(dayNum).padStart(2, '0');
          const dateStr = `${monthYear}-${dayStr}`;

          const parsed = parsePunchTimes(cellVal);
          if (parsed.attendanceCode === 'A' && !String(cellVal).trim()) return;

          logs.push({
            id: `att-${matchedEmp.id}-${dateStr}`,
            employeeId: matchedEmp.id,
            date: dateStr,
            attendanceCode: parsed.attendanceCode as any,
            checkIn: parsed.checkIn,
            checkOut: parsed.checkOut,
            workedMinutes: parsed.workedMinutes,
            requiredMinutes: 480,
            shortMinutes: Math.max(0, 480 - parsed.workedMinutes),
            extraMinutes: Math.max(0, parsed.workedMinutes - 480),
            sundayWorkedMinutes: 0,
            isManual: false,
          });
        });
      }
      return logs;
    }
  }

  // 2. Process Object Array Matrix & Flat Date Rows
  rawData.forEach((row: any, idx: number) => {
    if (!row || Array.isArray(row)) return;

    const rowTextCells = Object.values(row).map(c => String(c || '').trim());
    const matchedEmp = matchEmployeeByNameOrCode(rowTextCells);

    if (!matchedEmp) return;

    const rowKeys = Object.keys(row);
    let foundDayCols = false;

    for (let dayNum = 1; dayNum <= 31; dayNum++) {
      const padDayKey = String(dayNum).padStart(2, '0');
      const cellVal = getCellForDay(row, rowKeys, dayNum);

      if (cellVal !== undefined && cellVal !== null) {
        foundDayCols = true;
        const cellText = String(cellVal).trim();
        if (!cellText || cellText === 'NA') continue;

        const dateStr = `${monthYear}-${padDayKey}`;
        const parsed = parsePunchTimes(cellVal);

        logs.push({
          id: `att-${matchedEmp.id}-${dateStr}`,
          employeeId: matchedEmp.id,
          date: dateStr,
          attendanceCode: parsed.attendanceCode as any,
          checkIn: parsed.checkIn,
          checkOut: parsed.checkOut,
          workedMinutes: parsed.workedMinutes,
          requiredMinutes: 480,
          shortMinutes: Math.max(0, 480 - parsed.workedMinutes),
          extraMinutes: Math.max(0, parsed.workedMinutes - 480),
          sundayWorkedMinutes: 0,
          isManual: false,
        });
      }
    }

    // 3. Process Flat Date Row Object (e.g. { Date: "2026-08-01", "In Time": "09:15 AM", "Out Time": "06:30 PM", ... })
    if (!foundDayCols) {
      const keys = Object.keys(row);
      const findKeyVal = (patterns: string[]) => {
        const matchedKey = keys.find(k => patterns.some(p => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p)));
        return matchedKey ? String(row[matchedKey] || '').trim() : '';
      };

      const dateVal = findKeyVal(['date', 'workdate', 'attendancedate', 'day']);
      if (dateVal) {
        let dateStr = dateVal;
        if (!dateStr.includes('-') && dateStr.length === 8) {
          dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
        }

        const rawIn = findKeyVal(['intime', 'checkin', 'punchin', 'login', 'timein', 'entry', 'start']);
        const rawOut = findKeyVal(['outtime', 'checkout', 'punchout', 'logout', 'timeout', 'exit', 'end']);
        const rawStatus = findKeyVal(['status', 'attendancecode', 'code']);

        let parsed: ParsedPunchResult;

        if (rawIn || rawOut) {
          const combinedPunch = `${rawIn} ${rawOut}`.trim();
          parsed = parsePunchTimes(combinedPunch);
          if (rawStatus && ['WO', 'WO-I', 'A', 'HD', 'PL', 'CL', 'SL', 'UL'].includes(rawStatus.toUpperCase())) {
            parsed.attendanceCode = rawStatus.toUpperCase();
          }
        } else if (rawStatus) {
          parsed = parsePunchTimes(rawStatus);
        } else {
          parsed = { checkIn: '09:00', checkOut: '18:00', workedMinutes: 480, attendanceCode: 'P' };
        }

        logs.push({
          id: `att-${matchedEmp.id}-${dateStr}-${idx}`,
          employeeId: matchedEmp.id,
          date: dateStr,
          checkIn: parsed.checkIn,
          checkOut: parsed.checkOut,
          workedMinutes: parsed.workedMinutes,
          requiredMinutes: 480,
          shortMinutes: Math.max(0, 480 - parsed.workedMinutes),
          extraMinutes: Math.max(0, parsed.workedMinutes - 480),
          sundayWorkedMinutes: 0,
          attendanceCode: parsed.attendanceCode as any,
          isManual: false,
        });
      }
    }
  });

  return logs;
}
