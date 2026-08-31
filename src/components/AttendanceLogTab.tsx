'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Clock, Edit2, Calendar, LayoutGrid, List } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Holiday } from '@/lib/types';

interface AttendanceLogTabProps {
  hideImport?: boolean;
  targetEmployeeId?: string;
  showHoursFormat?: boolean;
}

const MONTHS = [
  { value: '1', name: 'January' },
  { value: '2', name: 'February' },
  { value: '3', name: 'March' },
  { value: '4', name: 'April' },
  { value: '5', name: 'May' },
  { value: '6', name: 'June' },
  { value: '7', name: 'July' },
  { value: '8', name: 'August' },
  { value: '9', name: 'September' },
  { value: '10', name: 'October' },
  { value: '11', name: 'November' },
  { value: '12', name: 'December' },
];

const YEARS = ['2024', '2025', '2026', '2027'];

const formatMins = (mins: number) => {
  if (!mins || mins <= 0) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export default function AttendanceLogTab({ hideImport = false, targetEmployeeId, showHoursFormat = false }: AttendanceLogTabProps) {
  const [viewMode, setViewMode] = useState<'matrix' | 'daily'>('matrix');
  const [selectedMonth, setSelectedMonth] = useState('8'); // August 2026
  const [selectedYear, setSelectedYear] = useState('2026');
  const [department, setDepartment] = useState('ALL');
  const [date, setDate] = useState('2026-08-12');

  const [logs, setLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [importMessage, setImportMessage] = useState('');

  // Quick edit modal state
  const [editLog, setEditLog] = useState<any | null>(null);
  const [editCode, setEditCode] = useState('P');
  const [editIn, setEditIn] = useState('09:00');
  const [editOut, setEditOut] = useState('18:00');
  const [reason, setReason] = useState('');

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let url = `/api/attendance?department=${department}`;
      if (viewMode === 'matrix') {
        url += `&month=${selectedMonth}&year=${selectedYear}`;
      } else {
        url += `&date=${date}`;
      }
      const [attRes, holRes] = await Promise.all([
        fetch(url),
        fetch('/api/holidays'),
      ]);
      const data = await attRes.json();
      const holData = await holRes.json();
      
      let empsList: any[] = data.employees || [];
      let logsList: any[] = data.logs || [];

      // If in Employee Portal mode (hideImport=true or targetEmployeeId provided), strictly show target employee only
      if (hideImport || targetEmployeeId) {
        let storedId = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_id') : null;
        let storedRole = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_role') : null;
        let targetId = (targetEmployeeId || storedId || '').toLowerCase().trim();

        let found = null;
        if (targetId) {
          found = empsList.find((e: any) =>
            (e.id && e.id.toLowerCase() === targetId) ||
            (e.employeeId && e.employeeId.toLowerCase() === targetId) ||
            (e.name && e.name.toLowerCase().includes(targetId))
          );
        }
        if (!found) {
          if (storedRole === 'ADMIN') {
            found = empsList.find((e: any) => e.role === 'ADMIN') || empsList[0];
          } else if (storedRole === 'MANAGER') {
            found = empsList.find((e: any) => e.role === 'MANAGER' || (e.name && e.name.toLowerCase().includes('naman'))) || empsList[1];
          } else {
            found = empsList.find((e: any) => e.employeeId === 'SG012' || (e.name && e.name.toLowerCase().includes('sonu'))) || empsList[0];
          }
        }
        if (found) {
          empsList = [found];
        }
        const activeEmp = empsList[0];
        if (activeEmp) {
          logsList = logsList.filter((l: any) =>
            l.employeeId === activeEmp.id || l.employeeId === activeEmp.employeeId || l.employeeId === activeEmp.name
          );
        }
      }

      if (Array.isArray(data.logs) && data.logs.length > 0) {
        if (typeof window !== 'undefined') {
          try {
            const existingCached = localStorage.getItem('hrm_attendance_backup');
            let mergedCached = data.logs;
            if (existingCached) {
              const parsed = JSON.parse(existingCached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const map: any = {};
                parsed.forEach((l: any) => { if (l && l.id) map[l.id] = l; });
                data.logs.forEach((l: any) => { if (l && l.id) map[l.id] = l; });
                mergedCached = Object.values(map);
              }
            }
            localStorage.setItem('hrm_attendance_backup', JSON.stringify(mergedCached));
          } catch (e) {}
        }
      } else if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('hrm_attendance_backup');
          if (cached) {
            const parsedCached = JSON.parse(cached);
            if (Array.isArray(parsedCached) && parsedCached.length > 0) {
              const syncRes = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync_client_backup', logs: parsedCached }),
              });
              const syncData = await syncRes.json();
              if (syncData && Array.isArray(syncData.logs) && syncData.logs.length > 0) {
                logsList = syncData.logs;
              } else {
                logsList = parsedCached;
              }
            }
          }
        } catch (e) {}
      }

      setLogs(logsList);
      setEmployees(empsList);
      setHolidays(Array.isArray(holData) ? holData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    const handleUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt && customEvt.detail) {
        const { month, year, monthYear } = customEvt.detail;
        if (monthYear) {
          const parts = monthYear.split('-');
          if (parts[0]) setSelectedYear(parts[0]);
          if (parts[1]) setSelectedMonth(String(Number(parts[1])));
        } else {
          if (month) setSelectedMonth(String(month));
          if (year) setSelectedYear(String(year));
        }
      }
      fetchAttendance();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('attendanceUpdated', handleUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('attendanceUpdated', handleUpdate);
      }
    };
  }, [viewMode, selectedMonth, selectedYear, department, date, targetEmployeeId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawMatrix = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const objectData = XLSX.utils.sheet_to_json(ws);

        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'IMPORT_MONTHLY_PUNCHES',
            filename: file.name,
            monthYear: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
            rows: rawMatrix.length > 0 ? rawMatrix : objectData,
          }),
        });

        const data = await res.json();
        const count = data.totalLogsParsed || data.import?.importedRows || 0;
        setImportMessage(`Successfully imported ${count} biometric punch logs!`);
        setTimeout(() => setImportMessage(''), 5000);
        fetchAttendance();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('attendanceUpdated', {
            detail: { month: selectedMonth, year: selectedYear, monthYear: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` }
          }));
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse biometric Excel file. Please verify file format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveEdit = async () => {
    if (!editLog) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MANUAL_EDIT',
          logId: editLog.id,
          employeeId: editLog.employeeId,
          date: editLog.date,
          attendanceCode: editCode,
          checkIn: editIn,
          checkOut: editOut,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditLog(null);
        fetchAttendance();

        if (typeof window !== 'undefined') {
          const [editY, editM] = (editLog.date || '').split('-');
          window.dispatchEvent(new CustomEvent('attendanceUpdated', {
            detail: {
              month: editM ? String(Number(editM)) : selectedMonth,
              year: editY || selectedYear,
              monthYear: editY && editM ? `${editY}-${editM}` : undefined
            }
          }));
        }
      } else {
        alert(data.error || 'Failed to save edit');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const normalizeDateKey = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    return dStr;
  };

  // Helper map for fast lookup in matrix grid across emp.id and emp.employeeId
  const logsMap: { [key: string]: any } = {};
  logs.forEach(l => {
    if (l && l.date) {
      const normDate = normalizeDateKey(l.date);
      logsMap[`${l.employeeId}_${normDate}`] = l;
      logsMap[`${l.employeeId}_${l.date}`] = l;

      const emp = employees.find(
        e => e.id === l.employeeId || e.employeeId === l.employeeId || (e.name && l.employeeId && e.name.toLowerCase() === l.employeeId.toLowerCase())
      );
      if (emp) {
        logsMap[`${emp.id}_${normDate}`] = l;
        logsMap[`${emp.id}_${l.date}`] = l;
        if (emp.employeeId) {
          logsMap[`${emp.employeeId}_${normDate}`] = l;
          logsMap[`${emp.employeeId}_${l.date}`] = l;
        }
      }
    }
  });

  // Calculate days in selected month for matrix header
  const totalDaysInMonth = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div>
          <h2 className="text-xl font-extrabold text-white font-heading flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span>{showHoursFormat ? 'Working Hours Biometric Matrix & Shift Desk' : 'Attendance Biometric Matrix & Punch Desk'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {showHoursFormat
              ? 'Auto-calculated daily shift completed hours, deficit, and overtime completed per employee.'
              : 'Complete month-at-a-glance employee check-in/out records, Sunday weekly offs (WO), and official company holidays.'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'matrix' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Monthly Grid</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                viewMode === 'daily' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Daily List</span>
            </button>
          </div>

          {!hideImport && (
            <div>
              <input type="file" id="biometric-import" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
              <label htmlFor="biometric-import" className="cursor-pointer px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center space-x-2 shrink-0">
                <Upload className="w-4 h-4" />
                <span>Import Biometric File</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {importMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400">
          {importMessage}
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          {viewMode === 'matrix' ? (
            <>
              {/* Month Dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-300">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[120px]"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Year Dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-300">Year</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[90px]"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-300">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Department Filter */}
          {!hideImport && (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-300">Department</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[150px]"
              >
                <option value="ALL">All Departments</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Development">Development</option>
                <option value="SEO">SEO</option>
                <option value="Founders Office">Founders Office</option>
                <option value="General">General</option>
              </select>
            </div>
          )}

          {/* Filter Action Button */}
          <button
            onClick={fetchAttendance}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition"
          >
            Filter
          </button>
        </div>

        <div className="text-xs text-slate-400 font-semibold">
          {viewMode === 'matrix' ? (
            <span>Showing matrix for <strong className="text-white">{MONTHS.find(m => m.value === selectedMonth)?.name} {selectedYear}</strong> ({employees.length} employees)</span>
          ) : (
            <span>Showing <strong className="text-white">{logs.length}</strong> log records for {date}</span>
          )}
        </div>
      </div>

      {/* MONTHLY MATRIX GRID VIEW (With Dual Horizontal & Vertical Scrollbars) */}
      {viewMode === 'matrix' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-auto max-h-[580px] relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-950 text-slate-300 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800 shadow-md">
              <tr>
                {/* Frozen Left Header */}
                <th className="py-4 px-4 sticky left-0 z-30 bg-slate-950 border-r border-b border-slate-800 min-w-[200px] shadow-sm text-slate-200 font-extrabold">
                  EMPLOYEE NAME
                </th>

                {/* Frozen Top Day Columns 1..31 */}
                {daysArray.map(dayNum => {
                  const padDay = String(dayNum).padStart(2, '0');
                  const padMonth = String(selectedMonth).padStart(2, '0');
                  const dateStr = `${selectedYear}-${padMonth}-${padDay}`;
                  const dateObj = new Date(dateStr);
                  const isSunday = dateObj.getDay() === 0;

                  const holiday = holidays.find(h => h.date === dateStr);

                  return (
                    <th
                      key={dayNum}
                      title={holiday ? holiday.name : undefined}
                      className={`py-3 px-2 text-center border-r border-b border-slate-800 min-w-[70px] ${
                        holiday
                          ? 'bg-rose-500/20 text-rose-300 font-extrabold border-b-2 border-b-rose-500'
                          : isSunday
                          ? 'bg-amber-500/10 text-amber-300 font-extrabold'
                          : ''
                      }`}
                    >
                      <span className="block text-xs">{dayNum}</span>
                      <span className="block text-[9px] font-normal opacity-80 truncate max-w-[65px]">
                        {holiday ? holiday.name : dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </th>
                  );
                })}

                {/* Cumulative Total Hours Header (if showHoursFormat) */}
                {showHoursFormat && (
                  <th className="py-4 px-3 text-center bg-slate-950 border-l border-b border-slate-800 min-w-[100px] text-indigo-300">
                    TOTAL HRS
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {employees.map(emp => {
                const empLogs = logs.filter(l => l.employeeId === emp.id || l.employeeId === emp.employeeId || (l.employeeId && emp.name && l.employeeId.toLowerCase() === emp.name.toLowerCase()));
                const empTotalMins = empLogs.reduce((sum, l) => sum + (l.workedMinutes || 0), 0);

                return (
                  <tr key={emp.id} className="hover:bg-slate-850/50 transition">
                    {/* Sticky Employee Name & Department Cell */}
                    <td className="py-3 px-4 sticky left-0 z-10 bg-slate-900 border-r border-slate-800 min-w-[200px] shadow-sm">
                      <p className="font-bold text-white text-xs truncate max-w-[180px]">{emp.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{emp.department} • {emp.designation}</p>
                    </td>

                    {/* Days 1..31 Punch Cells */}
                    {daysArray.map(dayNum => {
                      const padDay = String(dayNum).padStart(2, '0');
                      const padMonth = String(selectedMonth).padStart(2, '0');
                      const dateStr = `${selectedYear}-${padMonth}-${padDay}`;
                      const log = logsMap[`${emp.id}_${dateStr}`] || logsMap[`${emp.employeeId}_${dateStr}`];

                      const dateObj = new Date(dateStr);
                      const isSunday = dateObj.getDay() === 0;

                      // Check for Holiday
                      const holiday = holidays.find(h => h.date === dateStr);

                      // Sunday / Weekly Off
                      const isWeeklyOff = (log && (log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO')) || (isSunday && (!log || log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO'));

                      return (
                        <td
                          key={dayNum}
                          onClick={() => {
                            if (!hideImport) {
                              setEditLog(log || { id: `att-${emp.id}-${dateStr}`, employeeId: emp.id, employeeName: emp.name, date: dateStr });
                              setEditCode(log ? log.attendanceCode : (holiday ? 'HOLIDAY' : isSunday ? 'WO-I' : 'P'));
                              setEditIn(log ? log.checkIn || '09:00' : '09:00');
                              setEditOut(log ? log.checkOut || '18:00' : '18:00');
                            }
                          }}
                          className={`py-2 px-1 text-center border-r border-slate-800/60 transition cursor-pointer hover:bg-blue-600/20 ${
                            holiday ? 'bg-rose-500/10' : isSunday ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          {holiday ? (
                            /* HOLIDAY BADGE (e.g. Diwali, Holi, Republic Day) */
                            <span
                              className="inline-block px-1.5 py-1 rounded bg-rose-500/25 border border-rose-500/40 text-rose-300 font-extrabold text-[9px] uppercase shadow-sm leading-tight max-w-[65px] truncate"
                              title={holiday.name}
                            >
                              {holiday.name}
                            </span>
                          ) : isWeeklyOff ? (
                            /* WO Badge Matching Reference Image 1:1 */
                            <span className="inline-block px-2 py-1 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] uppercase shadow-sm">
                              WO
                            </span>
                          ) : log ? (
                            log.attendanceCode === 'A' ? (
                              <span className="inline-block px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-[10px]">
                                A
                              </span>
                            ) : log.attendanceCode === 'HD' ? (
                              <span className={`inline-block px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 font-bold text-[10px] ${showHoursFormat ? 'font-mono' : ''}`}>
                                {showHoursFormat ? '4h 0m' : 'HD'}
                              </span>
                            ) : log.attendanceCode === 'PL' || log.attendanceCode === 'UL' ? (
                              <span className="inline-block px-2 py-1 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px]">
                                {log.attendanceCode}
                              </span>
                            ) : showHoursFormat ? (
                              /* Completed Hours Format (e.g., 9h 0m, 8h 19m) */
                              <span className="font-mono text-[11px] font-extrabold text-emerald-400">
                                {formatMins(log.workedMinutes)}
                              </span>
                            ) : (
                              /* Present Check-In & Check-Out Times Stacked */
                              <div className="font-mono text-[10px] leading-tight space-y-0.5 font-medium">
                                <span className="block text-emerald-400">{log.checkIn || '--:--'}</span>
                                <span className="block text-slate-300">{log.checkOut || '--:--'}</span>
                              </div>
                            )
                          ) : (
                            <span className="text-slate-600 text-xs font-mono">-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Cumulative Total Completed Hours Cell (if showHoursFormat) */}
                    {showHoursFormat && (
                      <td className="py-3 px-3 text-center bg-slate-900 border-l border-slate-800 font-mono font-black text-indigo-400 text-xs">
                        {(empTotalMins / 60).toFixed(1)}h
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <th className="py-3.5 px-4">EMPLOYEE</th>
                  <th className="py-3.5 px-4 text-center">CODE</th>
                  <th className="py-3.5 px-4 text-center">CHECK IN</th>
                  <th className="py-3.5 px-4 text-center">CHECK OUT</th>
                  <th className="py-3.5 px-4 text-center">WORKED MINS</th>
                  <th className="py-3.5 px-4 text-center">SHORT MINS</th>
                  <th className="py-3.5 px-4 text-center">STATUS / REASON</th>
                  {!hideImport && <th className="py-3.5 px-4 text-right">ACTION</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{log.employeeName}</p>
                      <p className="text-[10px] text-slate-400">{log.department}</p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full font-bold font-mono text-[10px] ${
                        log.attendanceCode === 'P' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        log.attendanceCode === 'HD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        log.attendanceCode === 'MP' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {log.attendanceCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">{log.checkIn || '--:--'}</td>
                    <td className="py-3.5 px-4 text-center font-mono">{log.checkOut || '--:--'}</td>
                    <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-400">{log.workedMinutes || 0}m</td>
                    <td className="py-3.5 px-4 text-center font-mono text-amber-400">{log.shortMinutes || 0}m</td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-300">{log.status || 'Verified'}</td>
                    {!hideImport && (
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setEditLog(log);
                            setEditCode(log.attendanceCode);
                            setEditIn(log.checkIn || '09:00');
                            setEditOut(log.checkOut || '18:00');
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ml-auto"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK PUNCH EDIT MODAL */}
      {editLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fadeIn">
            <h3 className="text-lg font-bold text-white font-heading">
              Edit Biometric Record for {editLog.employeeName}
            </h3>
            <p className="text-xs text-slate-400">Date: <strong className="text-slate-200">{editLog.date}</strong></p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Attendance Code</label>
                <select
                  value={editCode}
                  onChange={e => setEditCode(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="P">P - Full Present</option>
                  <option value="HD">HD - Half Day</option>
                  <option value="A">A - Absent</option>
                  <option value="MP">MP - Missing Punch</option>
                  <option value="WO-I">WO-I - Weekly Off</option>
                  <option value="PL">PL - Planned Leave</option>
                  <option value="UL">UL - Unplanned Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Check In Time</label>
                  <input
                    type="time"
                    value={editIn}
                    onChange={e => setEditIn(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Check Out Time</label>
                  <input
                    type="time"
                    value={editOut}
                    onChange={e => setEditOut(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Reason for Override</label>
                <input
                  type="text"
                  placeholder="e.g. Biometric reader missed punch"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setEditLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition shadow-md"
              >
                Save Record Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
