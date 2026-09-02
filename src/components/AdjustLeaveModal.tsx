'use client';

import React, { useState } from 'react';
import { X, Scale, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Employee } from '@/lib/types';

interface AdjustLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  onSuccess: () => void;
}

export default function AdjustLeaveModal({
  isOpen,
  onClose,
  employees,
  quarter,
  onSuccess,
}: AdjustLeaveModalProps) {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [targetQuarter, setTargetQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>(quarter || 'Q3');
  const [leaveType, setLeaveType] = useState<'Casual Leave' | 'Planned Leave'>('Casual Leave');
  const [actionType, setActionType] = useState<'add_used' | 'deduct_used'>('add_used');
  const [days, setDays] = useState(1.0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setLoading(true);
    setMessage('');

    try {
      const emp = employees.find(e => e.name === selectedEmployee || e.id === selectedEmployee || e.employeeId === selectedEmployee);
      
      let targetDate = '2026-08-15';
      if (targetQuarter === 'Q1') targetDate = '2026-02-15';
      else if (targetQuarter === 'Q2') targetDate = '2026-05-15';
      else if (targetQuarter === 'Q3') targetDate = '2026-08-15';
      else if (targetQuarter === 'Q4') targetDate = '2026-11-15';

      const daysCount = actionType === 'add_used' ? days : -days;

      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: emp?.id || selectedEmployee,
          employeeName: emp?.name || selectedEmployee,
          leaveType,
          startDate: targetDate,
          endDate: targetDate,
          dayType: days === 0.5 ? 'first_half' : 'full',
          daysCount,
          allowOverlap: true,
          isAdjustment: true,
          isShortHours: true,
          reason: `Leave Balance Adjustment (${actionType}): ${reason || 'Adjusted for short working hours'}`,
          note: `Leave Balance Adjustment (${days} day ${leaveType}): ${reason || 'Cover short working hours'}`,
          status: 'APPROVED',
          managerStatus: 'Approved',
          hrStatus: 'Approved',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('leaveDataUpdated'));
          window.dispatchEvent(new Event('attendanceUpdated'));
        }
        setMessage('Successfully applied leave adjustment and auto-synced employee account!');
        setTimeout(() => {
          onSuccess();
          onClose();
          setMessage('');
        }, 800);
      } else {
        setMessage(data.error || 'Failed to adjust leave balance');
      }
    } catch (err: any) {
      console.error(err);
      setMessage('Error submitting adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">⚖️ Adjust Employee Leave Count</h3>
              <p className="text-xs text-blue-100/90">Add or deduct leaves for short working hours or credit bonus leaves</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {message && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                message.includes('Successfully')
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              {message.includes('Successfully') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message}</span>
            </div>
          )}

          {/* Select Employee */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Select Employee:</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.name}>
                  {emp.name} ({emp.department} • {emp.designation || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          {/* Quarter & Leave Type Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Quarter:</label>
              <select
                value={targetQuarter}
                onChange={e => setTargetQuarter(e.target.value as any)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Q1">Q1 (Jan - Mar)</option>
                <option value="Q2">Q2 (Apr - Jun)</option>
                <option value="Q3">Q3 (Jul - Sep)</option>
                <option value="Q4">Q4 (Oct - Dec)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Leave Type:</label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value as any)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Casual Leave">Casual Leave</option>
                <option value="Planned Leave">Planned Leave</option>
              </select>
            </div>
          </div>

          {/* Action Type & Days Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Adjustment Action:</label>
              <select
                value={actionType}
                onChange={e => setActionType(e.target.value as any)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition font-medium"
              >
                <option value="add_used">+ Consume Leave (Cover Short Hours)</option>
                <option value="deduct_used">- Restore/Credit Leave (Bonus Leave)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Number of Days:</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition font-mono font-bold"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Reason / Adjustment Note:</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Adjusted 1 day Casual Leave for 8.0h short working hours"
              rows={3}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Applying...' : 'Apply Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
