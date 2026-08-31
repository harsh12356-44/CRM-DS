'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit3, CheckCircle2, AlertCircle } from 'lucide-react';
import { LeaveSummary } from '@/lib/types';

interface EditTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: LeaveSummary | null;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  onSuccess: () => void;
}

export default function EditTrackerModal({
  isOpen,
  onClose,
  summary,
  quarter,
  onSuccess,
}: EditTrackerModalProps) {
  const [casualUsed, setCasualUsed] = useState(0);
  const [plannedUsed, setPlannedUsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (summary) {
      setCasualUsed(summary.casualUsed || 0);
      setPlannedUsed(summary.plannedUsed || 0);
      setMessage('');
    }
  }, [summary]);

  if (!isOpen || !summary) return null;

  const totalUsed = casualUsed + plannedUsed;
  const remaining = Math.max(0, 6 - totalUsed);
  const extraDeduct = Math.max(0, totalUsed - 6);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'override',
          employeeName: summary.employeeName,
          quarter,
          casualUsed,
          plannedUsed,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Successfully updated quarterly leave values!');
        setTimeout(() => {
          onSuccess();
          onClose();
          setMessage('');
        }, 800);
      } else {
        setMessage(data.error || 'Failed to update quarterly leave values');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error updating quarterly leave values');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Adjust Quarterly Leaves</h3>
              <p className="text-[11px] text-slate-400">Manual override values for selected quarter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {message && (
            <div
              className={`p-3 rounded-xl font-semibold flex items-center space-x-2 ${
                message.includes('Successfully')
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              {message.includes('Successfully') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{message}</span>
            </div>
          )}

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Employee Name:</span>
              <strong className="text-white font-semibold">{summary.employeeName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Target Quarter:</span>
              <strong className="text-blue-400 font-bold">{quarter}</strong>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300">Casual Leaves Used:</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={casualUsed}
              onChange={e => setCasualUsed(Math.max(0, Number(e.target.value)))}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300">Planned Leaves Used:</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={plannedUsed}
              onChange={e => setPlannedUsed(Math.max(0, Number(e.target.value)))}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white font-mono font-bold focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-300">Extra Leaves to Deduct:</label>
            <input
              type="text"
              readOnly
              value={extraDeduct > 0 ? `${extraDeduct} Day(s) Unpaid` : '0'}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-xl px-3.5 py-2 text-red-400 font-mono font-bold focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* Live Preview */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1 text-slate-200">
            <div className="flex justify-between">
              <span>Total Leaves Used:</span>
              <strong className="text-white font-mono">{totalUsed}</strong>
            </div>
            <div className="flex justify-between">
              <span>Remaining Leaves:</span>
              <strong className="text-emerald-400 font-mono">{remaining}</strong>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
