'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Employee } from '@/lib/types';

interface RecordLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSuccess: () => void;
}

export default function RecordLeaveModal({
  isOpen,
  onClose,
  employees,
  onSuccess,
}: RecordLeaveModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [dayType, setDayType] = useState<'full' | 'first_half' | 'second_half'>('full');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      setError('Please select an employee');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          leaveType,
          dayType,
          startDate,
          endDate: endDate || startDate,
          note,
          handoverNote,
          emergencyContact,
          status: 'APPROVED',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record leave');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-white">Record Leave Period</h3>
            <p className="text-xs text-slate-400">Adds leaves dynamically with half-day & handover note options</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              Select Employee: <span className="text-red-400">*</span>
            </label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">-- Choose Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.department})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Leave Type: <span className="text-red-400">*</span>
              </label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Casual Leave">Casual Leave</option>
                <option value="Planned Leave">Planned Leave</option>
                <option value="Sick Leave">Sick Leave</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Day Duration:
              </label>
              <select
                value={dayType}
                onChange={e => setDayType(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="full">Full Day (1.0)</option>
                <option value="first_half">First Half (0.5)</option>
                <option value="second_half">Second Half (0.5)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Start Date: <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                End Date (Optional):
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Handover Note</label>
              <input
                type="text"
                placeholder="e.g. Work handed to Priya"
                value={handoverNote}
                onChange={e => setHandoverNote(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Emergency Contact</label>
              <input
                type="text"
                placeholder="+91 98765 00000"
                value={emergencyContact}
                onChange={e => setEmergencyContact(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Reason / Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Medical / Family Leave..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Leaves'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
