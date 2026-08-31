'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, Download, CheckCircle, AlertTriangle, FileSpreadsheet, Send } from 'lucide-react';
import { PayrollPreview } from '@/lib/types';
import * as XLSX from 'xlsx';

export default function PayrollTab() {
  const [month, setMonth] = useState(7);
  const [year, setYear] = useState(2026);
  const [previews, setPreviews] = useState<PayrollPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
      const data = await res.json();
      setPreviews(Array.isArray(data.previews) ? data.previews : []);
    } catch (err) {
      console.error(err);
      setPreviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [month, year]);

  const handleFinalize = async (payrollId: string, currentComment: string) => {
    try {
      await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payrollId,
          status: 'Finalized',
          hrComment: currentComment || 'Approved by HR',
        }),
      });
      fetchPayroll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportPayrollCSV = () => {
    const exportData = previews.map((p) => ({
      'Employee Name': p.employeeName || '',
      'Department': p.department || '',
      'Monthly Salary (INR)': p.monthlySalary || 0,
      'Required Hours': p.requiredHours || 0,
      'Credited Hours': p.creditedHours || 0,
      'Short Hours': p.shortHours || 0,
      'Hourly Rate (INR)': p.hourlyRate || 0,
      'Estimated Deduction (INR)': p.estimatedDeduction || 0,
      'Missing Punches': p.missingPunches || 0,
      'Status': p.status || '',
      'HR Comment': p.hrComment || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Payroll_${month}_${year}`);
    XLSX.writeFile(wb, `HRM_Pilot_Payroll_Preview_${month}_${year}.xlsx`);
  };

  const totalMonthlySalary = previews.reduce((sum, p) => sum + (p.monthlySalary || 0), 0);
  const totalDeduction = previews.reduce((sum, p) => sum + (p.estimatedDeduction || 0), 0);
  const netPayable = totalMonthlySalary - totalDeduction;

  return (
    <div className="space-y-6 text-slate-100 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center space-x-2 font-heading">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span>Payroll & Salary Deduction Preview</span>
          </h2>
          <p className="text-xs text-slate-400">Automated hourly salary deduction previews, short hours calculations, and HR comments.</p>
        </div>

        <button
          onClick={handleExportPayrollCSV}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/30 transition flex items-center space-x-2"
        >
          <Download className="w-4 h-4" />
          <span>Export Payroll Excel</span>
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-xs text-slate-400 font-semibold">Total Gross Monthly Payroll</p>
          <p className="text-2xl font-black text-white mt-1 font-heading">₹{(totalMonthlySalary || 0).toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-xs text-slate-400 font-semibold">Total Short Hours Deductions</p>
          <p className="text-2xl font-black text-red-400 mt-1 font-heading">₹{(totalDeduction || 0).toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <p className="text-xs text-slate-400 font-semibold">Net Estimated Payable</p>
          <p className="text-2xl font-black text-emerald-400 mt-1 font-heading">₹{(netPayable || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center space-x-3 bg-slate-900/50 p-3 border border-slate-800 rounded-2xl">
        <span className="text-xs text-slate-400 font-semibold">Select Pay Period:</span>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">Year {year}</span>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <th className="py-3.5 px-4">EMPLOYEE</th>
                <th className="py-3.5 px-4 text-right">BASE SALARY</th>
                <th className="py-3.5 px-4 text-center">REQ / CREDITED HRS</th>
                <th className="py-3.5 px-4 text-center">SHORT HRS</th>
                <th className="py-3.5 px-4 text-right">HOURLY RATE</th>
                <th className="py-3.5 px-4 text-right">DEDUCTION</th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">Loading payroll previews...</td>
                </tr>
              ) : previews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">No payroll records found for this period.</td>
                </tr>
              ) : (
                previews.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-white">{p.employeeName}</p>
                      <p className="text-[10px] text-slate-400">{p.department}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-200">
                      ₹{(p.monthlySalary || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-300">
                      {p.requiredHours}h / <span className="text-emerald-400">{p.creditedHours}h</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-400">
                      {p.shortHours}h
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400">
                      ₹{p.hourlyRate}/h
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-red-400">
                      ₹{(p.estimatedDeduction || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'Finalized'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : p.status === 'Needs Attendance Review'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {p.status !== 'Finalized' ? (
                        <button
                          onClick={() => handleFinalize(p.id, p.hrComment || '')}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold transition"
                        >
                          Finalize
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">Approved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
