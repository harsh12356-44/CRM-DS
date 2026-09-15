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

export function normalizeToISODate(dateInput: any, defaultMonthYear: string = '2026-09'): string {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (!str) return '';

  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  if (str.match(/^\d{4}\/\d{2}\/\d{2}$/)) return str.replace(/\//g, '-');
  if (str.match(/^\d{8}$/)) {
    return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
  }

  const dmYMatch = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
  if (dmYMatch) {
    const day = String(dmYMatch[1]).padStart(2, '0');
    const month = String(dmYMatch[2]).padStart(2, '0');
    let year = dmYMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const monthMap: { [m: string]: string } = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12'
  };
  const namedMatch = str.match(/^(\d{1,2})[\/\s\.\-]([a-zA-Z]{3,4})(?:[\/\s\.\-](\d{2,4}))?$/);
  if (namedMatch) {
    const day = String(namedMatch[1]).padStart(2, '0');
    const mName = namedMatch[2].toLowerCase().substring(0, 3);
    const month = monthMap[mName] || '09';
    let year = namedMatch[3] || defaultMonthYear.split('-')[0] || '2026';
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const dayNum = parseInt(str, 10);
  if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31 && String(dayNum) === str) {
    const [y, m] = defaultMonthYear.split('-');
    return `${y || '2026'}-${String(m || '09').padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  }

  return str;
}

export function detectMonthYearFromFile(rawData: any[], fallbackMonthYear: string = '2026-09'): string {
  if (!Array.isArray(rawData) || rawData.length === 0) return fallbackMonthYear;

  const rawStr = JSON.stringify(rawData.slice(0, 50)).toLowerCase();
  
  if (rawStr.includes('sep') || rawStr.includes('september') || rawStr.includes('-09-') || rawStr.includes('/09/')) {
    return '2026-09';
  }
  if (rawStr.includes('aug') || rawStr.includes('august') || rawStr.includes('-08-') || rawStr.includes('/08/')) {
    return '2026-08';
  }
  if (rawStr.includes('jul') || rawStr.includes('july') || rawStr.includes('-07-') || rawStr.includes('/07/')) {
    return '2026-07';
  }
  if (rawStr.includes('oct') || rawStr.includes('october') || rawStr.includes('-10-') || rawStr.includes('/10/')) {
    return '2026-10';
  }

  return fallbackMonthYear;
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Strict Employee Matcher: MATCHES ONLY BY FULL NAME (FORGET ALL IDs / CODES)
export function matchEmployeeByNameOrCode(rowCells: string[], employees: Employee[]): Employee | undefined {
  if (!Array.isArray(rowCells) || rowCells.length === 0) return undefined;

  const toAlpha = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Extract candidate cells: strictly skip empty cells, header keywords, and pure numeric device IDs (e.g. 1, 2, 6, 7)
  const candidateCells = rowCells
    .map(c => String(c || '').trim())
    .filter(c => {
      if (!c) return false;
      // Strictly ignore pure numbers, device IDs, timestamps, or short codes (< 3 letters)
      const letters = c.replace(/[^a-zA-Z]/g, '');
      if (letters.length < 3) return false;
      if (c.includes(':')) return false;

      const lower = c.toLowerCase();
      if (['generated', 'total', 'summary', 'present', 'absent', 'weekly', 'department', 'designation', 'status', 'code', 'name', 's.no', 'sno', 'sl.no', 'slno', 'date', 'hours', 'time', 'shift', 'page', 'wo', 'wo-i', 'half'].some(k => lower.includes(k))) return false;
      return true;
    });

  // 1. PRIORITY 1: Exact Full Name Match (alphanumeric clean)
  // Handles "anup sen", "naman bangia", "charu Siddhawat", "charuBhati", "nandini gupta", "jigyasa sen", etc.
  for (const cell of candidateCells) {
    const cleanCell = toAlpha(cell);
    for (const emp of employees) {
      const cleanEmpName = toAlpha(emp.name);
      if (cleanCell === cleanEmpName) {
        return emp;
      }
    }
  }

  // 2. PRIORITY 2: Fuzzy Full Name Match for spelling differences
  // Handles variations like "ravina khemani" vs "Ravina Khimani", "shweta dadich" vs "Shweta dadhich"
  for (const cell of candidateCells) {
    const inputParts = cell.toLowerCase().trim().split(/[\s,._\-]+/).filter(Boolean);
    if (inputParts.length < 2) continue;

    const inputFirst = inputParts[0];
    const inputLast = inputParts[inputParts.length - 1];

    for (const emp of employees) {
      const sysParts = emp.name.toLowerCase().trim().split(/[\s,._\-]+/).filter(Boolean);
      if (sysParts.length < 2) continue;

      const sysFirst = sysParts[0];
      const sysLast = sysParts[sysParts.length - 1];

      // First names match exactly, and last names are within 2 characters typo distance
      if (inputFirst === sysFirst) {
        const dist = levenshteinDistance(inputLast, sysLast);
        if (dist <= 2) {
          return emp;
        }
      }
    }
  }

  // 3. PRIORITY 3: Single-Word Unique Name Match (e.g. "meenal", "mudita", "divyanshu", "bulbul", "amit", "garv", "rajvardhan")
  // CRITICAL: NEVER match if multiple employees share the first name (e.g. the two Charus: Charubhati vs Charu Siddhawat)!
  for (const cell of candidateCells) {
    const inputParts = cell.toLowerCase().trim().split(/[\s,._\-]+/).filter(Boolean);
    const firstName = inputParts[0] || '';
    if (firstName.length < 3) continue;

    const matches = employees.filter(emp => {
      const sysFirst = emp.name.toLowerCase().trim().split(/[\s,._\-]+/)[0] || '';
      return sysFirst === firstName || toAlpha(emp.name) === firstName;
    });

    if (matches.length === 1) {
      return matches[0];
    }
  }

  return undefined;
}

export function parseBiometricPunches(rawData: any[], employees: Employee[], monthYear: string = '2026-09'): AttendanceLog[] {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const logs: AttendanceLog[] = [];

  // Helper to dynamically extract cell value for day numbers 1..31 from row object
  function getCellForDay(rowObj: any, rowKeys: string[], dayNum: number) {
    const dayStr = String(dayNum);
    const padDayStr = String(dayNum).padStart(2, '0');

    const matchedKey = rowKeys.find(k => {
      const cleanK = k.trim().toLowerCase();
      if (cleanK === dayStr || cleanK === padDayStr) return true;
      if (cleanK === `day ${dayStr}` || cleanK === `day ${padDayStr}`) return true;
      if (cleanK === `day${dayStr}` || cleanK === `day${padDayStr}`) return true;

      // Match date formats like "01-Sep", "1-Sep", "01/09", "1/9", "01-09-2026", "Sep 1", "Sep 01"
      if (cleanK.includes('sep') || cleanK.includes('09') || cleanK.includes('sept')) {
        const nums = cleanK.match(/\d+/g);
        if (nums && nums.some(n => parseInt(n, 10) === dayNum)) return true;
      }

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
      const minDayCol = Object.keys(dayColumns).length > 0 ? Math.min(...Object.values(dayColumns)) : 4;

      for (let r = headerRowIdx + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!Array.isArray(row) || row.length < 2) continue;

        const rowTextCells = row.slice(0, minDayCol).map(c => String(c || '').trim());
        const matchedEmp = matchEmployeeByNameOrCode(rowTextCells, employees);

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
    const matchedEmp = matchEmployeeByNameOrCode(rowTextCells, employees);

    if (!matchedEmp) return;

    const rowKeys = Object.keys(row);

    // Detect if this row is a 31-day matrix row (has at least 3 distinct day number keys)
    const dayKeysCount = rowKeys.filter(k => {
      const cleanK = k.trim().toLowerCase();
      if (cleanK.match(/^day\s*\d+$/)) return true;
      const num = parseInt(cleanK, 10);
      return !isNaN(num) && num >= 1 && num <= 31 && String(num) === cleanK;
    }).length;

    const isMatrixRow = dayKeysCount >= 3;
    let foundDayCols = false;

    if (isMatrixRow) {
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
    }

    // 3. Process Flat Date Row Object (e.g. { Date: "2026-09-01", "In Time": "09:15 AM", "Out Time": "06:30 PM", ... })
    if (!foundDayCols) {
      const findKeyVal = (patterns: string[]) => {
        const matchedKey = rowKeys.find(k => patterns.some(p => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(p)));
        return matchedKey ? String(row[matchedKey] || '').trim() : '';
      };

      const dateVal = findKeyVal(['date', 'workdate', 'attendancedate', 'day']);
      if (dateVal) {
        const dateStr = normalizeToISODate(dateVal, monthYear);

        const rawIn = findKeyVal(['intime', 'checkin', 'punchin', 'login', 'timein', 'entry', 'start']);
        const rawOut = findKeyVal(['outtime', 'checkout', 'punchout', 'logout', 'timeout', 'exit', 'end']);
        const rawStatus = findKeyVal(['status', 'attendancecode', 'code', 'remark']);

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

        if (dateStr && dateStr.length >= 8) {
          logs.push({
            id: `att-${matchedEmp.id}-${dateStr}`,
            employeeId: matchedEmp.id,
            date: dateStr,
            checkIn: parsed.checkIn || '09:00',
            checkOut: parsed.checkOut || '18:00',
            workedMinutes: parsed.workedMinutes || 480,
            requiredMinutes: 480,
            shortMinutes: Math.max(0, 480 - (parsed.workedMinutes || 480)),
            extraMinutes: Math.max(0, (parsed.workedMinutes || 480) - 480),
            sundayWorkedMinutes: 0,
            attendanceCode: parsed.attendanceCode as any,
            isManual: false,
          });
        }
      }
    }
  });

  return logs;
}
