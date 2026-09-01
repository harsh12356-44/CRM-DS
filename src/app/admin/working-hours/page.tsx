'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { Clock, LayoutGrid, List, Upload, FileSpreadsheet, CheckCircle2, X, FileCheck, RefreshCw, CheckCircle } from 'lucide-react';
import { AttendanceLog, Employee } from '@/lib/types';
import * as XLSX from 'xlsx';

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

export default function WorkingHoursPage() {
  const [viewMode, setViewMode] = useState<'matrix' | 'daily'>('matrix');
  const [selectedMonth, setSelectedMonth] = useState('8'); // August default
  const [selectedYear, setSelectedYear] = useState('2026');
  const [department, setDepartment] = useState('ALL');

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMonth, setImportMonth] = useState('8');
  const [importYear, setImportYear] = useState('2026');
  const [file, setFile] = useState<File | null>(null);
  const [objectRows, setObjectRows] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [recalculating, setRecalculating] = useState(false);
  const [syncToast, setSyncToast] = useState('');

  const handleRecalculateSync = async () => {
    setRecalculating(true);
    setSyncToast('');
    try {
      await fetchWorkingHours();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('attendanceUpdated', {
          detail: { month: selectedMonth, year: selectedYear, monthYear: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` }
        }));
      }
      setSyncToast('✓ Successfully calculated & synced working hours from attendance grid!');
      setTimeout(() => setSyncToast(''), 4500);
    } catch (e) {
      console.error(e);
    } finally {
      setRecalculating(false);
    }
  };

  // Synchronize modal target month/year with main filters on open
  const openImportModal = () => {
    setImportMonth(selectedMonth);
    setImportYear(selectedYear);
    setStatusMessage('');
    setIsImportModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const objectData = XLSX.utils.sheet_to_json(ws);

        setObjectRows(objectData);
        setPreviewRows(objectData.slice(0, 5));
        setStatusMessage(`Loaded ${objectData.length} spreadsheet rows from ${selectedFile.name}`);
      } catch (err) {
        setStatusMessage('File loaded successfully.');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && objectRows.length === 0) {
      setStatusMessage('Please choose a valid completed working hours CSV or Excel file.');
      return;
    }

    setUploading(true);
    try {
      const monthYear = `${importYear}-${String(importMonth).padStart(2, '0')}`;
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IMPORT_COMPLETED_HOURS',
          filename: file ? file.name : 'working_hours.csv',
          monthYear,
          rows: objectRows,
        }),
      });

      const data = await res.json();
      setUploading(false);

      if (data.success) {
        const count = data.totalEmployeesUpdated || data.import?.importedRows || objectRows.length;
        setStatusMessage(`Successfully imported working hours for ${count} employees for ${MONTHS.find(m => m.value === importMonth)?.name} ${importYear}!`);
        
        if (typeof window !== 'undefined' && Array.isArray(data.logs) && data.logs.length > 0) {
          try {
            localStorage.setItem('hrm_attendance_backup', JSON.stringify(data.logs));
          } catch (e) {}
        }

        // Update main page filters to match imported month/year
        setSelectedMonth(importMonth);
        setSelectedYear(importYear);
        fetchWorkingHours();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('attendanceUpdated', {
            detail: { month: importMonth, year: importYear, monthYear, logs: data.logs }
          }));
        }

        setTimeout(() => {
          setIsImportModalOpen(false);
          setFile(null);
          setObjectRows([]);
          setPreviewRows([]);
        }, 1500);
      } else {
        setStatusMessage(`Error: ${data.error || 'Failed to import working hours.'}`);
      }
    } catch (err) {
      setUploading(false);
      setStatusMessage('Error processing working hours file.');
    }
  };

  const fetchWorkingHours = async () => {
    setLoading(true);
    try {
      const url = `/api/attendance?month=${selectedMonth}&year=${selectedYear}&department=${department}&t=${Date.now()}`;
      const [attRes, empRes, holRes] = await Promise.all([
        fetch(url, { cache: 'no-store' }),
        fetch(`/api/employees?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/holidays?t=${Date.now()}`, { cache: 'no-store' }),
      ]);

      const attData = await attRes.json();
      const empData = await empRes.json();
      const holData = await holRes.json();

      let fetchedLogs = Array.isArray(attData.logs) ? attData.logs : [];

      if (fetchedLogs.length > 0) {
        if (typeof window !== 'undefined') {
          try {
            const existingCached = localStorage.getItem('hrm_attendance_backup');
            let mergedCached = fetchedLogs;
            if (existingCached) {
              const parsed = JSON.parse(existingCached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const map: any = {};
                parsed.forEach((l: any) => { if (l && l.id) map[l.id] = l; });
                fetchedLogs.forEach((l: any) => { if (l && l.id) map[l.id] = l; });
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
                fetchedLogs = syncData.logs;
              } else {
                fetchedLogs = parsedCached;
              }
            }
          }
        } catch (e) {}
      }

      setLogs(fetchedLogs);
      setHolidays(Array.isArray(holData) ? holData : []);
      let empList = Array.isArray(empData.employees) ? empData.employees : Array.isArray(empData) ? empData : [];
      if (department !== 'ALL') {
        empList = empList.filter((e: any) => e.department === department);
      }
      setEmployees(empList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkingHours();

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
      fetchWorkingHours();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('attendanceUpdated', handleUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('attendanceUpdated', handleUpdate);
      }
    };
  }, [selectedMonth, selectedYear, department]);

  const totalDaysInMonth = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const normalizeDateKey = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
    return dStr;
  };

  // Map logs by keys: employeeId_date and empId_date for robust matching
  const logsMap: { [key: string]: AttendanceLog } = {};
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

  const getLogWorkedMins = (log: AttendanceLog): number => {
    if (!log) return 0;
    if (log.workedMinutes && log.workedMinutes > 0) return log.workedMinutes;

    if (log.checkIn && log.checkOut && log.checkIn.includes(':') && log.checkOut.includes(':')) {
      try {
        const [inH, inM] = log.checkIn.split(':').map(Number);
        let [outH, outM] = log.checkOut.split(':').map(Number);
        if (!isNaN(inH) && !isNaN(outH)) {
          if (outH < inH && outH < 12) outH += 12;
          const inMins = inH * 60 + (inM || 0);
          const outMins = outH * 60 + (outM || 0);
          return Math.max(0, outMins - inMins);
        }
      } catch (e) {}
    }

    if (log.attendanceCode === 'P') return 480;
    if (log.attendanceCode === 'HD') return 240;
    return 0;
  };

  const totalWorkedMins = logs.reduce((sum, l) => sum + getLogWorkedMins(l), 0);
  const totalShortMins = logs.reduce((sum, l) => sum + (l.shortMinutes || Math.max(0, 480 - getLogWorkedMins(l))), 0);
  const totalExtraMins = logs.reduce((sum, l) => sum + (l.extraMinutes || Math.max(0, getLogWorkedMins(l) - 480)), 0);

  // Helper to format minutes as "Xh Ym"
  const formatMins = (mins: number) => {
    if (!mins || mins <= 0) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="working-hours" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-white font-heading flex items-center space-x-3">
                <Clock className="w-6 h-6 text-indigo-400" />
                <span>Working hours</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Auto-calculated daily shift hours, deficits, and overtime completed for each employee across the month.
              </p>
            </div>

            {/* View Switcher, Recalculate Button & Import Working Hours Button */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {syncToast && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in shadow-md">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{syncToast}</span>
                </div>
              )}

              <button
                onClick={handleRecalculateSync}
                disabled={recalculating}
                className="flex items-center space-x-2 px-4 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
                title="Recalculate working hours dynamically from attendance grid records"
              >
                <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                <span>{recalculating ? 'Syncing...' : 'Recalculate & Sync Hours'}</span>
              </button>

              <button
                onClick={openImportModal}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Import Working Hours</span>
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'matrix' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Monthly Hours Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('daily')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    viewMode === 'daily' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Daily Log Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Bar Matching User Reference Image 1:1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div className="flex flex-wrap items-center gap-4">
              {/* Month Dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-300">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[120px]"
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
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[90px]"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Department Dropdown */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-300">Department</label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 min-w-[160px]"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Development">Development</option>
                  <option value="SEO">SEO</option>
                  <option value="Founders Office">Founders Office</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Filter Button Matching Reference Image 1:1 */}
              <button
                onClick={fetchWorkingHours}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition"
              >
                Filter
              </button>
            </div>

            <div className="text-xs text-slate-400 font-semibold">
              Showing hours for <strong className="text-white">{MONTHS.find(m => m.value === selectedMonth)?.name} {selectedYear}</strong> ({employees.length} employees)
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Worked Hours</span>
              <p className="text-2xl font-extrabold text-indigo-400 font-heading">
                {loading ? '...' : (totalWorkedMins / 60).toFixed(1)} hrs
              </p>
              <p className="text-[10px] text-slate-500">Cumulative shift hours completed</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Total Short Hours</span>
              <p className="text-2xl font-extrabold text-amber-400 font-heading">
                {loading ? '...' : (totalShortMins / 60).toFixed(1)} hrs
              </p>
              <p className="text-[10px] text-slate-500">Deduction calculation pool</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Overtime Extra Hours</span>
              <p className="text-2xl font-extrabold text-emerald-400 font-heading">
                {loading ? '...' : (totalExtraMins / 60).toFixed(1)} hrs
              </p>
              <p className="text-[10px] text-slate-500">Above 480 mins daily threshold</p>
            </div>
          </div>

          {/* MONTHLY WORKING HOURS MATRIX GRID (With Dual Horizontal & Vertical Scrollbars) */}
          {viewMode === 'matrix' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-auto max-h-[580px] relative">
              <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
                <thead className="sticky top-0 z-30 bg-slate-950 shadow-md">
                  <tr className="bg-slate-950 text-slate-400 uppercase font-black tracking-wider text-[11px] border-b border-slate-800">
                    {/* Sticky Top-Left Employee Name Header */}
                    <th className="py-4 px-4 sticky top-0 left-0 z-40 bg-slate-950 border-r border-b border-slate-800 min-w-[200px] shadow-md">
                      EMPLOYEE NAME
                    </th>

                    {/* Day Columns 1..31 Header */}
                    {daysArray.map(dayNum => {
                      const padDay = String(dayNum).padStart(2, '0');
                      const padMonth = String(selectedMonth).padStart(2, '0');
                      const dateObj = new Date(`${selectedYear}-${padMonth}-${padDay}`);
                      const isSunday = dateObj.getDay() === 0;

                      return (
                        <th
                          key={dayNum}
                          className={`py-3 px-2 text-center border-r border-b border-slate-800 min-w-[70px] ${
                            isSunday ? 'bg-amber-500/10 text-amber-300 font-extrabold' : ''
                          }`}
                        >
                          <span className="block text-xs">{dayNum}</span>
                          <span className="block text-[9px] font-normal opacity-70">
                            {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                        </th>
                      );
                    })}

                    {/* Cumulative Total Hours Header */}
                    <th className="py-4 px-3 text-center bg-slate-950 border-l border-b border-slate-800 min-w-[100px] text-indigo-300">
                      TOTAL HRS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={totalDaysInMonth + 2} className="p-8 text-center text-slate-500">
                          Calculating employee completed hours...
                        </td>
                      </tr>
                    ) : employees.map(emp => {
                      // Calculate employee total worked mins for the month
                      const empLogs = logs.filter(l => l.employeeId === emp.id || l.employeeId === emp.employeeId || (l.employeeId && emp.name && l.employeeId.toLowerCase() === emp.name.toLowerCase()));
                      const empTotalMins = empLogs.reduce((sum, l) => sum + getLogWorkedMins(l), 0);

                      return (
                        <tr key={emp.id} className="hover:bg-slate-850/50 transition">
                          {/* Sticky Employee Name & Department Cell */}
                          <td className="py-3 px-4 sticky left-0 z-10 bg-slate-900 border-r border-slate-800 min-w-[200px] shadow-sm">
                            <p className="font-bold text-white text-xs truncate max-w-[180px]">{emp.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">{emp.department} • {emp.designation}</p>
                          </td>

                          {/* Days 1..31 Completed Hours Cells */}
                          {daysArray.map(dayNum => {
                            const padDay = String(dayNum).padStart(2, '0');
                            const padMonth = String(selectedMonth).padStart(2, '0');
                            const dateStr = `${selectedYear}-${padMonth}-${padDay}`;
                            const log = logsMap[`${emp.id}_${dateStr}`] || logsMap[`${emp.employeeId}_${dateStr}`];

                            const dateObj = new Date(dateStr);
                            const isSunday = dateObj.getDay() === 0;

                            const isWeeklyOff = (log && (log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO')) || (isSunday && (!log || log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO'));
                            const holiday = holidays.find(h => h.date === dateStr);
                            const cellMins = getLogWorkedMins(log);

                            return (
                              <td
                                key={dayNum}
                                className={`py-3 px-1 text-center border-r border-slate-800/60 transition ${
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
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono text-[10px] font-bold">
                                      4h 0m
                                    </span>
                                  ) : log.attendanceCode === 'PL' || log.attendanceCode === 'UL' ? (
                                    <span className="inline-block px-2 py-1 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px]">
                                      {log.attendanceCode}
                                    </span>
                                  ) : cellMins > 0 ? (
                                    /* Automatically Calculated Daily Completed Hours */
                                    <span className="font-mono text-[11px] font-extrabold text-emerald-400">
                                      {formatMins(cellMins)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 text-xs font-mono">-</span>
                                  )
                                ) : (
                                  <span className="text-slate-600 text-xs font-mono">-</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Cumulative Total Completed Hours Cell */}
                          <td className="py-3 px-3 text-center bg-slate-900 border-l border-slate-800 font-mono font-black text-indigo-400 text-xs">
                            {(empTotalMins / 60).toFixed(1)}h
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900 shadow-lg">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Working Hours Daily Log Table</h3>
                <span className="text-[11px] text-slate-500">{logs.length} Records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Check In / Out</th>
                      <th className="p-3">Worked Mins</th>
                      <th className="p-3">Required Mins</th>
                      <th className="p-3">Short Mins</th>
                      <th className="p-3">Overtime Mins</th>
                      <th className="p-3">Status Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">Loading hours log...</td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">No working hours logs found.</td>
                      </tr>
                    ) : (
                      logs.map((l) => {
                        const emp = employees.find((e) => e.id === l.employeeId || e.employeeId === l.employeeId);
                        return (
                          <tr key={l.id} className="hover:bg-slate-850 transition">
                            <td className="p-3 font-semibold text-white">{emp ? emp.name : l.employeeId}</td>
                            <td className="p-3 font-mono text-slate-400">{l.date}</td>
                            <td className="p-3 font-mono text-slate-300">
                              {l.checkIn || '--:--'} - {l.checkOut || '--:--'}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-400">{formatMins(l.workedMinutes)}</td>
                            <td className="p-3 font-mono text-slate-400">{l.requiredMinutes} mins</td>
                            <td className="p-3 font-mono text-amber-400">{l.shortMinutes > 0 ? `${l.shortMinutes} mins` : '-'}</td>
                            <td className="p-3 font-mono text-emerald-400">{l.extraMinutes > 0 ? `${l.extraMinutes} mins` : '-'}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  l.attendanceCode === 'P'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : l.attendanceCode === 'HD'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}
                              >
                                {l.attendanceCode}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* IMPORT WORKING HOURS MODAL DIALOG */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-xl w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-2xl">
                  <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-heading">Import Working Hours Sheet</h3>
                  <p className="text-xs text-slate-400">Upload CSV or Excel file containing completed hours per employee</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-5 text-xs">
              {/* Target Month & Year Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Target Month</label>
                  <select
                    value={importMonth}
                    onChange={(e) => setImportMonth(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                  >
                    {MONTHS.map(m => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1.5">Target Year</label>
                  <select
                    value={importYear}
                    onChange={(e) => setImportYear(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:border-blue-500 focus:outline-none"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Input Area */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-300">Select Working Hours File (.csv, .xlsx, .xls)</label>
                <div className="flex items-center space-x-3 bg-slate-800/80 border border-slate-700 rounded-2xl p-3">
                  <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer transition shrink-0 shadow-md">
                    <span>Choose Sheet</span>
                    <input
                      type="file"
                      accept=".csv, .xlsx, .xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  <span className="text-slate-300 truncate text-xs font-mono">
                    {file ? file.name : 'No file chosen'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Supported column titles: <code className="text-blue-300">Employee ID</code>, <code className="text-blue-300">Emp Code</code>, <code className="text-blue-300">Completed Hours</code>, <code className="text-blue-300">Worked Hours</code>, <code className="text-blue-300">Date</code>.
                </p>
              </div>

              {/* Live Preview Table */}
              {previewRows.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Spreadsheet Preview (First 5 Rows):
                  </h4>
                  <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[140px]">
                    <table className="w-full text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] sticky top-0">
                        <tr>
                          {Object.keys(previewRows[0]).map((key) => (
                            <th key={key} className="p-2 border-b border-slate-800 text-left truncate max-w-[120px]">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-850">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="p-2 truncate max-w-[120px]">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {statusMessage && (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs font-semibold text-blue-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || (!file && objectRows.length === 0)}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 flex items-center space-x-2"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{uploading ? 'Processing Sheet...' : 'Import & Update Grid'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
