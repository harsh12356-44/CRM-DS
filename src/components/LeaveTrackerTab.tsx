'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Calendar,
  PlusCircle,
  Users,
  Search,
  PieChart,
  BarChart3,
  Edit2,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import RecordLeaveModal from './RecordLeaveModal';
import AdjustLeaveModal from './AdjustLeaveModal';
import EditTrackerModal from './EditTrackerModal';
import TrackerDetailModal from './TrackerDetailModal';
import { LeaveSummary, Employee } from '@/lib/types';
import * as XLSX from 'xlsx';

export default function LeaveTrackerTab() {
  const [quarter, setQuarterState] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q3');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'used' | 'unused' | 'alert'>('all');
  const [summaries, setSummaries] = useState<LeaveSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [editModalSummary, setEditModalSummary] = useState<LeaveSummary | null>(null);
  const [detailModalEmp, setDetailModalEmp] = useState<{ id: string; name: string } | null>(null);
  const [importStatus, setImportStatus] = useState('');

  // Sync quarter from URL parameter or localStorage on mount & navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlQ = params.get('quarter');
      const saved = urlQ || localStorage.getItem('hrm_leave_quarter');
      if (saved && ['Q1', 'Q2', 'Q3', 'Q4'].includes(saved)) {
        setQuarterState(saved as 'Q1' | 'Q2' | 'Q3' | 'Q4');
      }
    }
  }, []);

  const setQuarter = (newQ: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    setQuarterState(newQ);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrm_leave_quarter', newQ);
      const url = new URL(window.location.href);
      url.searchParams.set('quarter', newQ);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const fetchLeaveData = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaves?quarter=${quarter}&t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      setSummaries(data.summaries || []);
      setEmployees(data.employees || []);
    } catch (err) {
      console.error('Failed to fetch leave data:', err);
    }
  }, [quarter]);

  useEffect(() => {
    fetchLeaveData();

    const handleUpdate = () => fetchLeaveData();
    window.addEventListener('leaveDataUpdated', handleUpdate);
    return () => window.removeEventListener('leaveDataUpdated', handleUpdate);
  }, [fetchLeaveData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;
        const wb = XLSX.read(buffer, { type: 'array' });

        const excelDateToISO = (serial: any) => {
          if (!serial) return null;
          if (typeof serial === 'string') {
            const trimmed = serial.trim();
            if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) return trimmed;
          }
          const num = Number(serial);
          if (isNaN(num)) return String(serial);
          const utc_days = Math.floor(num - 25569);
          const utc_value = utc_days * 86400;
          const date_info = new Date(utc_value * 1000);
          return date_info.toISOString().split('T')[0];
        };

        let employeeMasterRows: any[] = [];
        const parsedRecords: any[] = [];

        // 1. Employee Master Sheet (if present)
        const empMasterSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('employee master') || n.toLowerCase().includes('employee roster'));
        if (empMasterSheetName) {
          const rawEmpRows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[empMasterSheetName]);
          employeeMasterRows = rawEmpRows.map(r => {
            const clean: any = {};
            Object.keys(r).forEach(k => {
              clean[k.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim()] = r[k];
            });
            return {
              employeeId: clean['Employee ID'] || clean['ID'],
              name: clean['Employee Name'] || clean['Name'] || clean['Employee'],
              department: clean['Department'] || 'Development',
              status: clean['Status'] || 'ACTIVE',
            };
          }).filter(emp => emp.name);
        }

        // 2. Target EXCLUSIVELY the Quarterly Leave Summary sheet
        let summarySheetName = wb.SheetNames.find(n => n.toLowerCase().includes('quarterly leave summary') || n.toLowerCase().includes('quarterly summary'));
        if (!summarySheetName) {
          summarySheetName = wb.SheetNames.find(n => n.toLowerCase().includes('summary') || !n.toLowerCase().includes('how to use')) || wb.SheetNames[0];
        }

        const sheet = wb.Sheets[summarySheetName];
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (matrix && matrix.length > 0) {
          let headerRowIndex = -1;
          matrix.forEach((r, idx) => {
            const lineStr = (r || []).join(' ').toLowerCase();
            if ((lineStr.includes('jan-mar') || lineStr.includes('q1')) && (lineStr.includes('q2') || lineStr.includes('q3'))) {
              headerRowIndex = idx;
            }
          });

          if (headerRowIndex === -1) {
            matrix.forEach((r, idx) => {
              const lineStr = (r || []).join(' ').toLowerCase();
              if (lineStr.includes('employee name') || lineStr.includes('casual')) {
                if (headerRowIndex === -1) headerRowIndex = idx > 0 ? idx - 1 : idx;
              }
            });
          }

          if (headerRowIndex !== -1 && matrix.length > headerRowIndex + 1) {
            const colIndices: any = { empName: 0, Q1: {}, Q2: {}, Q3: {}, Q4: {} };
            const subHeader = matrix[headerRowIndex + 1] || [];
            let currentQ = 'Q1';

            subHeader.forEach((colVal: any, cIdx: number) => {
              const str = String(colVal || '').toLowerCase().replace(/\s+/g, ' ');
              if (cIdx === 0 || str.includes('employee') || str.includes('name')) colIndices.empName = cIdx;

              const mainHeaderVal = String(matrix[headerRowIndex][cIdx] || '').toLowerCase();
              if (mainHeaderVal.includes('q1') || mainHeaderVal.includes('jan')) currentQ = 'Q1';
              else if (mainHeaderVal.includes('q2') || mainHeaderVal.includes('apr')) currentQ = 'Q2';
              else if (mainHeaderVal.includes('q3') || mainHeaderVal.includes('jul')) currentQ = 'Q3';
              else if (mainHeaderVal.includes('q4') || mainHeaderVal.includes('oct')) currentQ = 'Q4';

              if (str.includes('casual')) colIndices[currentQ].casual = cIdx;
              if (str.includes('planned')) colIndices[currentQ].planned = cIdx;
              if (str.includes('extra')) colIndices[currentQ].extra = cIdx;
            });

            matrix.forEach((row, idx) => {
              if (idx <= headerRowIndex + 1) return;
              const empName = row[colIndices.empName];
              if (empName && typeof empName === 'string' && empName.trim() && !empName.toLowerCase().includes('employee name')) {
                const name = empName.trim();
                ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
                  const casIdx = colIndices[q].casual;
                  const plaIdx = colIndices[q].planned;
                  const extIdx = colIndices[q].extra;

                  const casual = casIdx !== undefined ? Number(row[casIdx] || 0) : 0;
                  let planned = plaIdx !== undefined ? Number(row[plaIdx] || 0) : 0;
                  const extraRaw = extIdx !== undefined ? row[extIdx] : 0;

                  let extraNum = 0;
                  if (typeof extraRaw === 'number') extraNum = extraRaw;
                  else if (typeof extraRaw === 'string') {
                    const match = extraRaw.match(/(\d+)\s*leave/i) || extraRaw.match(/(\d+)\s*extra/i) || extraRaw.match(/(\d+)\s*day/i) || extraRaw.match(/(\d+)/);
                    if (match) extraNum = Number(match[1]);
                  }

                  planned += extraNum;

                  parsedRecords.push({
                    employeeName: name,
                    quarter: q,
                    casualUsed: casual,
                    plannedUsed: planned,
                    startDate: q === 'Q1' ? '2026-02-15' : q === 'Q2' ? '2026-05-15' : q === 'Q3' ? '2026-08-15' : '2026-11-15',
                    endDate: q === 'Q1' ? '2026-02-15' : q === 'Q2' ? '2026-05-15' : q === 'Q3' ? '2026-08-15' : '2026-11-15',
                    status: 'APPROVED',
                  });
                });
              }
            });
          } else {
            // Level 2 Fallback for flat CSV
            const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);
            rawRows.forEach(r => {
              const clean: any = {};
              Object.keys(r).forEach(k => {
                const cleanKey = k.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                clean[cleanKey] = r[k];
              });

              const nameKey = Object.keys(clean).find(k => k.includes('employee') || k.includes('name') || k === 'emp');
              const empName = nameKey ? clean[nameKey] : null;

              if (empName && !String(empName).includes('ℹ️') && !String(empName).toLowerCase().includes('how to use')) {
                const casualKey = Object.keys(clean).find(k => k.includes('casual'));
                const plannedKey = Object.keys(clean).find(k => k.includes('planned') || k.includes('sick'));
                const quarterKey = Object.keys(clean).find(k => k.includes('quarter') || k.includes('qtr'));
                const casual = casualKey ? Number(clean[casualKey] || 0) : 0;
                const planned = plannedKey ? Number(clean[plannedKey] || 0) : 0;
                const qtr = quarterKey ? String(clean[quarterKey]).trim() : 'Q3';

                parsedRecords.push({
                  employeeName: String(empName).trim(),
                  startDate: '2026-08-15',
                  endDate: '2026-08-15',
                  quarter: qtr,
                  casualUsed: casual,
                  plannedUsed: planned,
                  status: 'APPROVED',
                });
              }
            });
          }
        }

        setImportStatus(`Importing ${parsedRecords.length} leave records from ${file.name}...`);

        const res = await fetch('/api/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import',
            records: parsedRecords,
            employeeMaster: employeeMasterRows,
          }),
        });

        const resData = await res.json();
        if (res.ok) {
          setImportStatus(resData.message || `Successfully imported ${parsedRecords.length} leave records!`);
          fetchLeaveData();
        } else {
          setImportStatus(resData.error || 'Import failed');
        }

        setTimeout(() => setImportStatus(''), 6000);
      } catch (err) {
        console.error(err);
        setImportStatus('Error parsing spreadsheet file. Please upload a valid CSV or XLSX.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearLeaves = async () => {
    if (!confirm('Are you sure you want to clear all leave records? This will reset all leave counts to 0 across all portals.')) return;

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('hrm_user_submitted_leaves');
        localStorage.removeItem('hrm_leave_records_backup');
        localStorage.removeItem('hrm_leave_quarter_overrides');
      }
      setImportStatus('Clearing all leave records...');
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all', quarter }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportStatus('All leave records cleared successfully!');
        if (data.summaries) {
          setSummaries(data.summaries);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('leaveDataUpdated'));
          window.dispatchEvent(new Event('attendanceUpdated'));
        }
        fetchLeaveData();
      } else {
        setImportStatus(data.error || 'Failed to clear leaves');
      }
      setTimeout(() => setImportStatus(''), 5000);
    } catch (err) {
      console.error(err);
      setImportStatus('Failed to clear leave records.');
    }
  };

  const handleExport = () => {
    const dataToExport = summaries.map(s => ({
      'Employee ID': s.employeeId,
      'Employee Name': s.employeeName,
      Department: s.department,
      Quarter: quarter,
      'Casual Leaves Used': s.casualUsed,
      'Planned Leaves Used': s.plannedUsed,
      'Total Leaves Used': s.totalUsed,
      'Remaining Leaves': s.remaining,
      'Extra Leaves to Deduct': s.extraDeduct,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Leave_Summary_${quarter}`);
    XLSX.writeFile(wb, `HRM_Pilot_Leave_Summary_${quarter}.xlsx`);
  };

  // Filter summaries by search & statusFilter
  const filteredSummaries = summaries.filter(s => {
    const matchesSearch = s.employeeName.toLowerCase().includes(search.toLowerCase());
    let matchesStatus = true;
    if (statusFilter === 'used') matchesStatus = s.totalUsed > 0;
    if (statusFilter === 'unused') matchesStatus = s.totalUsed === 0;
    if (statusFilter === 'alert') matchesStatus = s.extraDeduct > 0;
    return matchesSearch && matchesStatus;
  });

  // Stat calculations
  const totalEmployeesCount = summaries.length;
  const totalCasualUsed = summaries.reduce((sum, s) => sum + s.casualUsed, 0);
  const totalPlannedUsed = summaries.reduce((sum, s) => sum + s.plannedUsed, 0);
  const totalLeavesUsed = totalCasualUsed + totalPlannedUsed;
  const totalRemaining = summaries.reduce((sum, s) => sum + s.remaining, 0);
  const deductionAlertEmps = summaries.filter(s => s.extraDeduct > 0);
  const totalDeductionAlerts = deductionAlertEmps.length;

  // Donut chart calculations
  const chartBase = Math.max(1, totalCasualUsed + totalPlannedUsed + totalRemaining);
  const casualPct = (totalCasualUsed / chartBase) * 100;
  const plannedPct = (totalPlannedUsed / chartBase) * 100;
  const donutBackground = `conic-gradient(#2563eb 0 ${casualPct}%, #7c3aed ${casualPct}% ${casualPct + plannedPct}%, #334155 ${casualPct + plannedPct}% 100%)`;

  // Top 7 employees ranked by total used
  const topUsedEmps = [...summaries]
    .sort((a, b) => b.totalUsed - a.totalUsed)
    .slice(0, 7);
  const maxTopUsed = Math.max(1, ...topUsedEmps.map(e => e.totalUsed));

  return (
    <div className="space-y-6 text-slate-100 pb-12">
      {/* 1. Top Import Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Import Leave Summary Tracker</h4>
            <p className="text-xs text-slate-400">Upload your legacy Leave Policy Tracker spreadsheet (.csv, .xlsx, .xls) to populate quarterly summaries.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <input
            type="file"
            id="csv-import"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="csv-import"
            className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/30 transition flex items-center space-x-2"
          >
            <span>Import Data</span>
          </label>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs font-medium text-blue-300">
          {importStatus}
        </div>
      )}

      {/* 2. Hero Banner */}
      <div className="rounded-2xl p-6 md:p-8 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 backdrop-blur-md text-blue-300 text-xs font-semibold border border-blue-500/20">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Quarterly Leave System</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Quarterly Leave Overview
          </h2>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed opacity-95">
            This dashboard mirrors your uploaded tracker with Casual Used, Planned Used, Total Used, Remaining, and Extra Leaves to Deduct for every employee.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsAdjustModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-indigo-700 text-xs font-bold shadow-md transition flex items-center space-x-2"
            >
              <span>⚖️ Adjust Employee Leave</span>
            </button>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-900/40 transition flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Leave Period</span>
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold border border-slate-700 transition flex items-center space-x-2"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Export Current Quarter</span>
            </button>
            <button
              onClick={handleClearLeaves}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold shadow-md transition flex items-center space-x-2"
            >
              <span>🗑️ Clear All Leaves</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Quarter Selector Pills */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {[
          { key: 'Q1', label: 'Q1 · Jan–Mar' },
          { key: 'Q2', label: 'Q2 · Apr–Jun' },
          { key: 'Q3', label: 'Q3 · Jul–Sep' },
          { key: 'Q4', label: 'Q4 · Oct–Dec' },
        ].map(q => (
          <button
            key={q.key}
            onClick={() => {
              const qKey = q.key as 'Q1' | 'Q2' | 'Q3' | 'Q4';
              setQuarter(qKey);
              if (typeof window !== 'undefined') {
                localStorage.setItem('hrm_leave_quarter', qKey);
                window.scrollTo({ top: 120, behavior: 'smooth' });
              }
            }}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              quarter === q.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* 4. 5 Stat Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Card 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Employees</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{totalEmployeesCount}</span>
            <span className="text-[10px] text-slate-500 ml-2">Total Employees</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Casual Leaves Used</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">
              C
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-400">{totalCasualUsed}</span>
            <span className="text-[10px] text-slate-500 ml-2">Days</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Planned Leaves Used</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">
              P
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-purple-400">{totalPlannedUsed}</span>
            <span className="text-[10px] text-slate-500 ml-2">Days</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Leaves Used</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
              Σ
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-400">{totalLeavesUsed}</span>
            <span className="text-[10px] text-slate-500 ml-2">Days</span>
          </div>
        </div>

        {/* Card 5 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Deduction Alerts</span>
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-bold text-sm">
              !
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-red-400">{totalDeductionAlerts}</span>
            <span className="text-[10px] text-slate-500 ml-2">Employees</span>
          </div>
        </div>
      </div>

      {/* 5. 2 Charts Cards Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: Leave Usage Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-blue-400" />
                <span>Leave Usage Distribution</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">{quarter} summary · {summaries.length} employees</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2 min-h-[200px]">
            {/* Conic Donut Graphic */}
            <div
              className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-lg transition-all"
              style={{ background: donutBackground }}
            >
              <div className="w-28 h-28 bg-slate-900 rounded-full flex flex-col items-center justify-center text-center shadow-inner">
                <span className="text-2xl font-extrabold text-white">{totalLeavesUsed}</span>
                <span className="text-[11px] text-slate-400">used</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                <span className="text-slate-300">Casual used:</span>
                <strong className="text-white font-bold">{totalCasualUsed}</strong>
              </div>
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 rounded-sm bg-purple-600 inline-block" />
                <span className="text-slate-300">Planned used:</span>
                <strong className="text-white font-bold">{totalPlannedUsed}</strong>
              </div>
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 rounded-sm bg-slate-700 inline-block" />
                <span className="text-slate-400">Remaining:</span>
                <strong className="text-slate-200 font-bold">{totalRemaining}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Highest Leave Usage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span>Highest Leave Usage</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Employees ranked by total used</p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {topUsedEmps.map(s => (
              <div key={s.employeeId} className="grid grid-cols-[110px_1fr_45px] items-center gap-2 text-xs">
                <span className="font-semibold text-slate-200 truncate">{s.employeeName}</span>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${(s.totalUsed / maxTopUsed) * 100}%` }}
                  />
                </div>
                <span className="text-right font-mono font-bold text-white">{s.totalUsed}</span>
              </div>
            ))}
          </div>

          {/* Red Alert Box */}
          {deductionAlertEmps.length > 0 && (
            <div className="p-3 bg-orange-950/40 border border-orange-500/40 rounded-xl text-xs text-orange-200 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-orange-300">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span>Deduction Alerts Exceeded Limit:</span>
              </div>
              <div className="space-y-0.5 pl-5 text-[11px]">
                {deductionAlertEmps.map(e => (
                  <div key={e.employeeId}>
                    <strong>{e.employeeName}</strong>: {e.extraDeduct} Day(s) Unpaid {e.monthDeductionText ? `(${e.monthDeductionText})` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Employee Leave Register Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Controls Header */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50">
          <div>
            <h3 className="text-base font-bold text-white">Employee Leave Register</h3>
            <p className="text-xs text-slate-400">
              {quarter} • {filteredSummaries.length} records shown
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 transition"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="all">All Employees</option>
              <option value="used">Leave Used</option>
              <option value="unused">No Leave Used</option>
              <option value="alert">Deduction Alert</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-extrabold border-b border-slate-800">
                <th className="py-3.5 px-4 w-[22%]">EMPLOYEE</th>
                <th className="py-3.5 px-4 text-center w-[10%]">CASUAL USED</th>
                <th className="py-3.5 px-4 text-center w-[10%]">PLANNED USED</th>
                <th className="py-3.5 px-4 text-center w-[10%]">TOTAL USED</th>
                <th className="py-3.5 px-4 text-center w-[10%]">REMAINING</th>
                <th className="py-3.5 px-4 w-[16%]">UTILIZATION</th>
                <th className="py-3.5 px-4 text-center w-[12%]">EXTRA LEAVES TO DEDUCT</th>
                <th className="py-3.5 px-4 text-center w-[10%]">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                    No employee records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map(s => {
                  const avatarInitials = s.employeeName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={s.employeeId} className="hover:bg-slate-800/40 transition">
                      {/* Employee Cell */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-xs shadow">
                            {avatarInitials}
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{s.employeeName}</p>
                            <span className="text-[10px] text-slate-400">{s.department}</span>
                          </div>
                        </div>
                      </td>

                      {/* Casual Used */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-400">
                        {s.casualUsed}
                      </td>

                      {/* Planned Used */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-purple-400">
                        {s.plannedUsed}
                      </td>

                      {/* Total Used */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                        {s.totalUsed}
                      </td>

                      {/* Remaining */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-300">
                        {s.remaining}
                      </td>

                      {/* Utilization */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>{s.utilizationPercentage}%</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all"
                              style={{ width: `${s.utilizationPercentage}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Extra Leaves to Deduct */}
                      <td className="py-3.5 px-4 text-center">
                        {s.extraDeduct > 0 ? (
                          <div className="flex flex-col items-center">
                            <span className="px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold font-mono text-xs">
                              {s.extraDeduct} Day(s) Unpaid
                            </span>
                            {s.monthDeductionText && (
                              <span className="text-[10px] font-semibold text-rose-300/90 mt-1">
                                ({s.monthDeductionText})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">0</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setDetailModalEmp({ id: s.employeeId, name: s.employeeName })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                            title="View Complete 4-Quarter Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditModalSummary(s)}
                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition"
                            title="Adjust Quarterly Leaves"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Leave Modal */}
      <RecordLeaveModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        employees={employees}
        onSuccess={fetchLeaveData}
      />

      {/* Adjust Leave Modal */}
      <AdjustLeaveModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        employees={employees}
        quarter={quarter}
        onSuccess={fetchLeaveData}
      />

      {/* Edit Quarterly Leaves Override Modal */}
      <EditTrackerModal
        isOpen={!!editModalSummary}
        onClose={() => setEditModalSummary(null)}
        summary={editModalSummary}
        quarter={quarter}
        onSuccess={fetchLeaveData}
      />

      {/* Tracker Complete 4-Quarter Detail Modal */}
      <TrackerDetailModal
        isOpen={!!detailModalEmp}
        onClose={() => setDetailModalEmp(null)}
        employeeId={detailModalEmp?.id || null}
        employeeName={detailModalEmp?.name || null}
        currentQuarter={quarter}
      />
    </div>
  );
}
