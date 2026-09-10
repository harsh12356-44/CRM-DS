'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { BarChart3, Award, Activity } from 'lucide-react';
import { AttendanceLog, Employee } from '@/lib/types';

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

export default function AttendanceAnalyticsPage() {
  const [selectedMonth, setSelectedMonth] = useState('7'); // July default
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('emp-1'); // Default to Ravina Khimani
  const [hoveredDay, setHoveredDay] = useState<any>(null);

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const [attRes, empRes] = await Promise.all([
        fetch(`/api/attendance?month=${selectedMonth}&year=${selectedYear}`),
        fetch(`/api/employees`),
      ]);

      const attData = await attRes.json();
      const empData = await empRes.json();

      const fetchedLogs = Array.isArray(attData.logs) ? attData.logs : [];
      const fetchedEmps = Array.isArray(empData.employees) ? empData.employees : Array.isArray(empData) ? empData : [];

      setLogs(fetchedLogs);
      setEmployees(fetchedEmps);

      if (fetchedEmps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(fetchedEmps[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedMonth, selectedYear]);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId || e.employeeId === selectedEmployeeId) || employees[0];

  // Individual Candidate Logs for selected month
  const candidateLogs = selectedEmployee ? logs.filter(l => l.employeeId === selectedEmployee.id) : [];

  const totalDaysInMonth = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
  const daysArray = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const candidatePresentDays = candidateLogs.filter(l => l.attendanceCode === 'P').length;
  const candidateHalfDays = candidateLogs.filter(l => l.attendanceCode === 'HD').length;
  const candidateAbsentDays = candidateLogs.filter(l => l.attendanceCode === 'A').length;
  const candidateWeeklyOffs = candidateLogs.filter(l => l.attendanceCode === 'WO-I' || l.attendanceCode === 'WO').length;
  const candidateLeaves = candidateLogs.filter(l => l.attendanceCode === 'PL' || l.attendanceCode === 'UL').length;

  const candidateTotalWorkingDays = Math.max(1, candidatePresentDays + candidateHalfDays + candidateAbsentDays + candidateLeaves);
  const candidateAttendanceRate = Math.round(((candidatePresentDays + candidateHalfDays * 0.5) / candidateTotalWorkingDays) * 100) || 0;

  // Map logs by date string
  const logsByDate: { [date: string]: AttendanceLog } = {};
  candidateLogs.forEach(l => {
    logsByDate[l.date] = l;
  });

  const monthName = MONTHS.find(m => m.value === selectedMonth)?.name;

  return (
    <div className="min-h-screen bg-slate-950 font-sans antialiased text-slate-100 flex flex-col">
      <Navbar currentRole="ADMIN" />
      <div className="flex flex-1">
        <Sidebar currentTab="attendance-analytics" />
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto overflow-y-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-extrabold text-white font-heading flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-purple-400" />
                <span>Attendance Analytics</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Visual daily completed hours bar graph analytics and status breakdown for individual candidates.
              </p>
            </div>

            {/* Candidate Selector Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-300">Select Candidate:</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500 min-w-[200px] shadow-sm"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId} • {emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.name}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* INDIVIDUAL CANDIDATE ANALYTICS PROFILE CARD */}
          {selectedEmployee && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/80 pb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg border border-purple-400/30">
                    {selectedEmployee.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white font-heading">{selectedEmployee.name}</h2>
                    <p className="text-xs text-purple-400 font-semibold">{selectedEmployee.designation} • {selectedEmployee.department}</p>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                      <span>ID: <strong className="text-slate-200">{selectedEmployee.employeeId || selectedEmployee.id}</strong></span>
                      <span>•</span>
                      <span>Manager: <strong className="text-slate-200">{selectedEmployee.manager1 || selectedEmployee.managerName || 'Ravina Khimani'}</strong></span>
                      <span>•</span>
                      <span>Joined: <strong className="text-slate-200">{selectedEmployee.dateOfJoining || '2024-01-15'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800 shrink-0">
                  <Award className="w-6 h-6 text-amber-400" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Monthly Attendance Score</span>
                    <p className="text-lg font-extrabold text-amber-400 font-heading">
                      {candidateAttendanceRate >= 90 ? 'Excellent (A+)' : candidateAttendanceRate >= 75 ? 'Good (B)' : 'Needs Improvement'}
                    </p>
                  </div>
                </div>
              </div>

              {/* DAILY COMPLETED HOURS BAR GRAPH ANALYTICS */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-heading flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Daily Completed Hours Bar Graph Analytics ({monthName} {selectedYear})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Represents exact number of hours worked by <strong className="text-white">{selectedEmployee.name}</strong> for each day of the month.
                    </p>
                  </div>

                  {/* Chart Legend */}
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
                    <span className="flex items-center space-x-1 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                      <span>≥ 8.0h Overtime</span>
                    </span>
                    <span className="flex items-center space-x-1 text-indigo-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
                      <span>8.0h Full Shift</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
                      <span>Short / HD</span>
                    </span>
                    <span className="flex items-center space-x-1 text-amber-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-500"></span>
                      <span>WO</span>
                    </span>
                    <span className="flex items-center space-x-1 text-red-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span>
                      <span>Absent</span>
                    </span>
                  </div>
                </div>

                {/* Interactive Bar Chart Visualization Container */}
                <div className="relative pt-6 pb-2 overflow-x-auto">
                  {/* 8-Hour Target Shift Baseline */}
                  <div className="absolute left-0 right-0 top-[33.33%] border-b-2 border-dashed border-indigo-500/40 z-0 flex items-center justify-between px-2">
                    <span className="text-[9px] font-mono font-bold text-indigo-400 bg-slate-950 px-1 rounded">8h Shift Requirement</span>
                    <span className="text-[9px] font-mono font-bold text-indigo-400 bg-slate-950 px-1 rounded">8.0h Target</span>
                  </div>

                  {/* Bar Columns Container */}
                  <div className="flex items-end space-x-1.5 h-64 min-w-[900px] px-2 relative z-10">
                    {daysArray.map(dayNum => {
                      const padDay = String(dayNum).padStart(2, '0');
                      const padMonth = String(selectedMonth).padStart(2, '0');
                      const dateStr = `${selectedYear}-${padMonth}-${padDay}`;
                      const log = logsByDate[dateStr];

                      const dateObj = new Date(dateStr);
                      const isSunday = dateObj.getDay() === 0;
                      const weekdayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                      const workedMins = log ? log.workedMinutes || 0 : 0;
                      const hours = workedMins / 60;
                      const maxHoursScale = 12; // 12 hours max scale
                      const heightPercent = Math.min(100, Math.max(6, (hours / maxHoursScale) * 100));

                      const isWeeklyOff = (log && (log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO')) || (isSunday && (!log || log.attendanceCode === 'WO-I' || log.attendanceCode === 'WO'));
                      const isAbsent = log && log.attendanceCode === 'A';
                      const isHalfDay = log && log.attendanceCode === 'HD';

                      return (
                        <div
                          key={dayNum}
                          className="flex-1 flex flex-col items-center group relative cursor-pointer"
                          onMouseEnter={() => setHoveredDay({ dayNum, dateStr, weekdayStr, log, hours })}
                          onMouseLeave={() => setHoveredDay(null)}
                        >
                          {/* Value above bar */}
                          <span className="text-[9px] font-mono font-bold text-slate-300 mb-1">
                            {isWeeklyOff ? 'WO' : isAbsent ? 'A' : isHalfDay ? '4h' : hours > 0 ? `${hours.toFixed(1)}h` : '-'}
                          </span>

                          {/* Dynamic Bar */}
                          <div className="w-full bg-slate-900 rounded-t-lg overflow-hidden flex items-end h-48 relative border-b border-slate-800">
                            {isWeeklyOff ? (
                              <div className="w-full h-full bg-amber-500/15 border-t-2 border-amber-500/40 rounded-t-md flex items-center justify-center">
                                <span className="text-[9px] font-extrabold text-amber-300 font-mono rotate-[-90deg]">WO</span>
                              </div>
                            ) : isAbsent ? (
                              <div className="w-full h-3 bg-red-500/40 border-t-2 border-red-500 rounded-t-md"></div>
                            ) : (
                              <div
                                style={{ height: `${heightPercent}%` }}
                                className={`w-full transition-all duration-300 rounded-t-md ${
                                  hours >= 8
                                    ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/20 group-hover:from-emerald-500 group-hover:to-teal-300'
                                    : hours > 0
                                    ? 'bg-gradient-to-t from-amber-600 to-yellow-400 group-hover:from-amber-500 group-hover:to-yellow-300'
                                    : 'bg-slate-800'
                                }`}
                              ></div>
                            )}
                          </div>

                          {/* Day Number and Weekday Label */}
                          <div className="mt-2 text-center">
                            <span className={`block text-[10px] font-black font-mono ${isSunday ? 'text-amber-400' : 'text-slate-300'}`}>
                              {dayNum}
                            </span>
                            <span className="block text-[8px] font-semibold text-slate-500 uppercase">
                              {weekdayStr}
                            </span>
                          </div>

                          {/* Hover Tooltip Popup */}
                          {hoveredDay && hoveredDay.dayNum === dayNum && (
                            <div className="absolute bottom-20 z-50 bg-slate-900 border border-purple-500/40 rounded-xl p-3 shadow-2xl text-left min-w-[170px] pointer-events-none animate-fadeIn">
                              <p className="text-[11px] font-bold text-white font-heading">{dateStr} ({weekdayStr})</p>
                              <p className="text-[10px] text-purple-300 font-semibold">{selectedEmployee.name}</p>
                              <div className="border-t border-slate-800 my-1.5"></div>
                              {isWeeklyOff ? (
                                <span className="text-xs font-bold text-amber-300">Weekly Off (Sunday)</span>
                              ) : isAbsent ? (
                                <span className="text-xs font-bold text-red-400">Absent (0 Mins)</span>
                              ) : (
                                <div className="space-y-0.5 text-[10px] font-mono">
                                  <p className="text-slate-300">Check In: <strong className="text-white">{log?.checkIn || '--:--'}</strong></p>
                                  <p className="text-slate-300">Check Out: <strong className="text-white">{log?.checkOut || '--:--'}</strong></p>
                                  <p className="text-emerald-400 font-bold">Worked: {hours.toFixed(1)} hrs ({workedMins} mins)</p>
                                  {log && log.extraMinutes > 0 && <p className="text-emerald-300">Overtime: +{log.extraMinutes} mins</p>}
                                  {log && log.shortMinutes > 0 && <p className="text-amber-400">Shortage: -{log.shortMinutes} mins</p>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
