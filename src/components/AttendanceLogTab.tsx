'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Clock, Edit2, Calendar, LayoutGrid, List, User, CheckCircle2, AlertTriangle, ChevronDown, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Holiday, isDateWeeklyOff } from '@/lib/types';

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
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [department, setDepartment] = useState('ALL');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [mobileSelectedEmpId, setMobileSelectedEmpId] = useState<string>('');

  useEffect(() => {
    if (employees.length > 0 && (!mobileSelectedEmpId || !employees.some(e => e.id === mobileSelectedEmpId))) {
      setMobileSelectedEmpId(employees[0].id);
    }
  }, [employees, mobileSelectedEmpId]);

  const fetchAttendance = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
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

      if (!attRes.ok || !holRes.ok) return;

      const data = await attRes.json();
      const holData = await holRes.json();
      
      let empsList: any[] = data.employees || [];
      let logsList: any[] = data.logs || [];
      setAllEmployees(empsList);

      // If in Employee Portal mode (hideImport=true or targetEmployeeId provided), strictly show target employee only
      if (hideImport || targetEmployeeId) {
        let storedId = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_id') : null;
        let storedEmail = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_email') : null;
        let storedRole = typeof window !== 'undefined' ? localStorage.getItem('hrm_active_employee_role') : null;
        let targetId = (targetEmployeeId || storedId || '').toLowerCase().trim();

        let found = null;
        if (targetId) {
          found = empsList.find((e: any) =>
            (e.id && e.id.toLowerCase().trim() === targetId) ||
            (e.employeeId && e.employeeId.toLowerCase().trim() === targetId) ||
            (e.name && e.name.toLowerCase().includes(targetId))
          );
        }
        if (!found && storedEmail) {
          const cleanEmail = storedEmail.toLowerCase().trim();
          const prefix = cleanEmail.split('@')[0];
          found = empsList.find((e: any) =>
            (e.email && e.email.toLowerCase().trim() === cleanEmail) ||
            (e.email && e.email.toLowerCase().split('@')[0] === prefix) ||
            (e.name && e.name.toLowerCase().includes(prefix))
          );
        }
        if (!found) {
          const matchingEmps = empsList.filter((e: any) => e.role === storedRole);
          found = matchingEmps[0] || empsList[0];
        }
        if (found) {
          empsList = [found];
        }
        const activeEmp = empsList[0];
        if (activeEmp) {
          logsList = logsList.filter((l: any) =>
            l.employeeId === activeEmp.id ||
            l.employeeId === activeEmp.employeeId ||
            (l.employeeId && activeEmp.name && l.employeeId.toLowerCase().trim() === activeEmp.name.toLowerCase().trim())
          );
        }
      }

      setLogs(logsList);
      setEmployees(empsList);
      setHolidays(Array.isArray(holData) ? holData : []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance(false);

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
      fetchAttendance(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('attendanceUpdated', handleUpdate);
    }

    // Auto polling silently every 6s to reflect updates live without UI lag
    const pollInterval = setInterval(() => {
      fetchAttendance(true);
    }, 6000);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('attendanceUpdated', handleUpdate);
      }
      clearInterval(pollInterval);
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
          id: editLog.id,
          employeeId: editLog.employeeId,
          date: editLog.date,
          attendanceCode: editCode,
          checkIn: editIn,
          checkOut: editOut,
          correctionReason: reason,
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

  // Helper map for fast lookup in matrix grid across emp.id, emp.employeeId, and emp.name
  const logsMap: { [key: string]: any } = {};
  const empListToSearch = allEmployees.length > 0 ? allEmployees : employees;

  logs.forEach(l => {
    if (l && l.date) {
      const normDate = normalizeDateKey(l.date);
      logsMap[`${l.employeeId}_${normDate}`] = l;
      logsMap[`${l.employeeId}_${l.date}`] = l;

      const emp = empListToSearch.find(
        e => e.id === l.employeeId || e.employeeId === l.employeeId || (e.name && l.employeeId && e.name.toLowerCase().trim() === l.employeeId.toLowerCase().trim())
      );
      if (emp) {
        logsMap[`${emp.id}_${normDate}`] = l;
        logsMap[`${emp.id}_${l.date}`] = l;
        if (emp.employeeId) {
          logsMap[`${emp.employeeId}_${normDate}`] = l;
          logsMap[`${emp.employeeId}_${l.date}`] = l;
        }
        if (emp.name) {
          logsMap[`${emp.name}_${normDate}`] = l;
          logsMap[`${emp.name}_${l.date}`] = l;
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

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                viewMode === 'matrix' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Monthly Grid</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
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
              <label htmlFor="biometric-import" className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center space-x-2 shrink-0 min-h-[38px]">
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
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
          {viewMode === 'matrix' ? (
            <>
              {/* Month Dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-300">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[40px] font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[120px]"
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
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[40px] font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[90px]"
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
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[40px] font-semibold text-white focus:outline-none focus:border-blue-500"
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
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs min-h-[40px] font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[150px]"
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
            onClick={() => fetchAttendance(false)}
            className="px-5 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition cursor-pointer"
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

      {/* MONTHLY MATRIX GRID VIEW (Dual Desktop Horizontal Matrix + Mobile Vertical Day-by-Day Timeline) */}
      {viewMode === 'matrix' ? (
        <>
          {/* Desktop Table View (Horizontal 31-day Matrix with Sticky Headers) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-auto max-h-[580px] relative">
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
                        const isDayOff = isDateWeeklyOff(dateStr, emp.weeklyOff);

                        // Check for Holiday
                        const holiday = holidays.find(h => h.date === dateStr);

                        // Weekly Off
                        const isWeeklyOff = (log && (log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO')) || (isDayOff && (!log || log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO'));

                        return (
                          <td
                            key={dayNum}
                            onClick={() => {
                              if (!hideImport) {
                                setEditLog(log || { id: `att-${emp.id}-${dateStr}`, employeeId: emp.id, employeeName: emp.name, date: dateStr });
                                setEditCode(log ? log.attendanceCode : (holiday ? 'HOLIDAY' : isDayOff ? 'WO-I' : 'P'));
                                setEditIn(log ? log.checkIn || '09:00' : '09:00');
                                setEditOut(log ? log.checkOut || '18:00' : '18:00');
                              }
                            }}
                            className={`py-2 px-1 text-center border-r border-slate-800/60 transition cursor-pointer hover:bg-blue-600/20 ${
                              holiday ? 'bg-rose-500/10' : isDayOff ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            {holiday ? (
                              <span
                                className="inline-block px-1.5 py-1 rounded bg-rose-500/25 border border-rose-500/40 text-rose-300 font-extrabold text-[9px] uppercase shadow-sm leading-tight max-w-[65px] truncate"
                                title={holiday.name}
                              >
                                {holiday.name}
                              </span>
                            ) : isWeeklyOff ? (
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
                                <span className="font-mono text-[11px] font-extrabold text-emerald-400">
                                  {formatMins(log.workedMinutes)}
                                </span>
                              ) : (
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

          {/* VERTICAL MOBILE VIEW (Zero Horizontal Scrolling • 100% Screen-Adjusted) */}
          <div className="md:hidden space-y-4">
            {/* If multiple employees (Admin Mode): Touch-friendly Employee Selector */}
            {employees.length > 1 && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-md space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Select Employee</span>
                  <span className="text-blue-400 font-mono text-[10px]">{employees.length} Members</span>
                </label>
                <div className="relative">
                  <select
                    value={mobileSelectedEmpId}
                    onChange={e => setMobileSelectedEmpId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-base text-white font-bold focus:outline-none focus:border-blue-500 min-h-[46px] pr-8 appearance-none"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.department || 'Staff'})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Active Employee Monthly Summary Header Card */}
            {(() => {
              const activeEmp = employees.find(e => e.id === mobileSelectedEmpId) || employees[0];
              if (!activeEmp) return null;

              const activeEmpLogs = logs.filter(l => l.employeeId === activeEmp.id || l.employeeId === activeEmp.employeeId || (l.employeeId && activeEmp.name && l.employeeId.toLowerCase() === activeEmp.name.toLowerCase()));
              const activeEmpTotalMins = activeEmpLogs.reduce((sum, l) => sum + (l.workedMinutes || 0), 0);
              const activeEmpPresentCount = activeEmpLogs.filter(l => l.attendanceCode === 'P').length;
              const activeEmpHalfDayCount = activeEmpLogs.filter(l => l.attendanceCode === 'HD').length;
              const activeEmpAbsentCount = activeEmpLogs.filter(l => l.attendanceCode === 'A').length;

              return (
                <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow">
                        {activeEmp.name?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-white">{activeEmp.name}</h4>
                        <p className="text-[10px] text-slate-400">{activeEmp.department} • {activeEmp.designation || 'Staff'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-mono font-black text-emerald-400 block">
                        {(activeEmpTotalMins / 60).toFixed(1)}h
                      </span>
                      <span className="text-[9px] uppercase font-bold text-slate-500">Month Total</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80 text-center">
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Present</span>
                      <span className="text-xs font-black text-emerald-400 font-mono mt-0.5 block">{activeEmpPresentCount}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Half Day</span>
                      <span className="text-xs font-black text-amber-400 font-mono mt-0.5 block">{activeEmpHalfDayCount}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Absent</span>
                      <span className="text-xs font-black text-red-400 font-mono mt-0.5 block">{activeEmpAbsentCount}</span>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Days</span>
                      <span className="text-xs font-black text-blue-400 font-mono mt-0.5 block">{totalDaysInMonth}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* VERTICAL DAY-BY-DAY LIST (Days 1..31 arranged vertically) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Daily Calendar Breakdown ({MONTHS.find(m => m.value === selectedMonth)?.name} {selectedYear})
                </span>
                <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  Vertical View
                </span>
              </div>

              {(() => {
                const activeEmp = employees.find(e => e.id === mobileSelectedEmpId) || employees[0];
                if (!activeEmp) {
                  return (
                    <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 rounded-2xl border border-slate-800">
                      No employee record found.
                    </div>
                  );
                }

                return daysArray.map(dayNum => {
                  const padDay = String(dayNum).padStart(2, '0');
                  const padMonth = String(selectedMonth).padStart(2, '0');
                  const dateStr = `${selectedYear}-${padMonth}-${padDay}`;
                  const log = logsMap[`${activeEmp.id}_${dateStr}`] || logsMap[`${activeEmp.employeeId}_${dateStr}`] || logsMap[`${activeEmp.name?.toLowerCase().trim()}_${dateStr}`];

                  const dateObj = new Date(dateStr);
                  const isSunday = dateObj.getDay() === 0;
                  const isDayOff = isDateWeeklyOff(dateStr, activeEmp.weeklyOff);
                  const weekdayShort = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const weekdayLong = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                  const holiday = holidays.find(h => h.date === dateStr);
                  const isWeeklyOff = (log && (log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO')) || (isDayOff && (!log || log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO'));

                  return (
                    <div
                      key={dayNum}
                      onClick={() => {
                        if (!hideImport) {
                          setEditLog(log || { id: `att-${activeEmp.id}-${dateStr}`, employeeId: activeEmp.id, employeeName: activeEmp.name, date: dateStr });
                          setEditCode(log ? log.attendanceCode : (holiday ? 'HOLIDAY' : isDayOff ? 'WO-I' : 'P'));
                          setEditIn(log ? log.checkIn || '09:00' : '09:00');
                          setEditOut(log ? log.checkOut || '18:00' : '18:00');
                        }
                      }}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                        holiday
                          ? 'bg-rose-950/20 border-rose-500/40'
                          : isWeeklyOff
                          ? 'bg-amber-950/15 border-amber-500/30'
                          : log && log.attendanceCode === 'P'
                          ? 'bg-slate-900/90 border-slate-800'
                          : log && log.attendanceCode === 'A'
                          ? 'bg-red-950/20 border-red-500/30'
                          : 'bg-slate-950/70 border-slate-800/80'
                      } ${!hideImport ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Left: Date Box & Weekday */}
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-bold text-center shrink-0 ${
                            holiday
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : isDayOff
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-white border border-slate-700'
                          }`}>
                            <span className="text-sm font-mono font-black leading-none">{padDay}</span>
                            <span className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">{weekdayShort}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 truncate">
                              <span className="text-xs font-bold text-white truncate">
                                {padDay} {MONTHS.find(m => m.value === selectedMonth)?.name}
                              </span>
                              <span className="text-[10px] text-slate-400">({weekdayLong})</span>
                            </div>

                            {holiday ? (
                              <span className="text-[11px] font-bold text-rose-300 flex items-center space-x-1 mt-0.5 truncate">
                                <span>🏖️</span>
                                <span className="truncate">{holiday.name}</span>
                              </span>
                            ) : isWeeklyOff ? (
                              <span className="text-[11px] font-semibold text-amber-300/90 mt-0.5 block">
                                Official Sunday Off
                              </span>
                            ) : log ? (
                              <div className="text-[11px] text-slate-300 font-mono mt-0.5 flex items-center space-x-2">
                                <span>In: <strong className="text-emerald-400">{log.checkIn || '--:--'}</strong></span>
                                <span>•</span>
                                <span>Out: <strong className="text-slate-200">{log.checkOut || '--:--'}</strong></span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 mt-0.5 block">No punch recorded</span>
                            )}
                          </div>
                        </div>

                        {/* Right: Status Pill or Working Hours */}
                        <div className="shrink-0 text-right">
                          {holiday ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase">
                              Holiday
                            </span>
                          ) : isWeeklyOff ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                              WO
                            </span>
                          ) : log ? (
                            log.attendanceCode === 'A' ? (
                              <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold">
                                Absent
                              </span>
                            ) : log.attendanceCode === 'HD' ? (
                              <span className="px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-[10px] font-bold">
                                {showHoursFormat ? '4h 0m' : 'Half Day'}
                              </span>
                            ) : log.attendanceCode === 'PL' || log.attendanceCode === 'UL' ? (
                              <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                                {log.attendanceCode === 'PL' ? 'Paid Leave' : 'Unpaid'}
                              </span>
                            ) : showHoursFormat ? (
                              <div className="text-right">
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-black inline-block">
                                  {formatMins(log.workedMinutes)}
                                </span>
                                {log.workedMinutes && log.workedMinutes < 480 ? (
                                  <span className="block text-[9px] font-mono font-bold text-amber-400 mt-0.5">
                                    -{formatMins(480 - log.workedMinutes)} Deficit
                                  </span>
                                ) : log.workedMinutes && log.workedMinutes > 480 ? (
                                  <span className="block text-[9px] font-mono font-bold text-emerald-400 mt-0.5">
                                    +{formatMins(log.workedMinutes - 480)} OT
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold inline-block">
                                  Present ✓
                                </span>
                                {log.workedMinutes ? (
                                  <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                                    {formatMins(log.workedMinutes)}
                                  </span>
                                ) : null}
                              </div>
                            )
                          ) : (
                            <span className="text-slate-600 text-xs font-mono">-</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ml-auto cursor-pointer"
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

          {/* Mobile Vertical Daily Log Cards */}
          <div className="md:hidden space-y-3 p-4">
            {logs.length > 0 ? (
              logs.map(log => (
                <div key={log.id} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">{log.employeeName}</p>
                      <p className="text-[10px] text-slate-400">{log.department}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full font-bold font-mono text-[10px] ${
                      log.attendanceCode === 'P' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      log.attendanceCode === 'HD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      log.attendanceCode === 'MP' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {log.attendanceCode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/80 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Check In:</span>
                      <span className="font-bold text-emerald-400">{log.checkIn || '--:--'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Check Out:</span>
                      <span className="font-bold text-slate-200">{log.checkOut || '--:--'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400 font-mono text-[11px]">Worked: <strong className="text-white">{log.workedMinutes || 0}m</strong></span>
                    {!hideImport && (
                      <button
                        onClick={() => {
                          setEditLog(log);
                          setEditCode(log.attendanceCode);
                          setEditIn(log.checkIn || '09:00');
                          setEditOut(log.checkOut || '18:00');
                        }}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg text-xs font-semibold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No logs recorded for this date.
              </div>
            )}
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
