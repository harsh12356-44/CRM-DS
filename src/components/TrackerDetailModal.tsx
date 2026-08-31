'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, User } from 'lucide-react';

interface QuarterDetail {
  label: string;
  casual: number;
  planned: number;
  total: number;
  remaining: number;
  extra: number;
  monthText?: string;
}

interface TrackerDetailData {
  employeeName: string;
  employeeId: string;
  department: string;
  quarters: Record<string, QuarterDetail>;
}

interface TrackerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  employeeName: string | null;
  currentQuarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
}

export default function TrackerDetailModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  currentQuarter,
}: TrackerDetailModalProps) {
  const [data, setData] = useState<TrackerDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && (employeeId || employeeName)) {
      setLoading(true);
      fetch(`/api/leaves?employeeDetails=${encodeURIComponent(employeeId || employeeName || '')}`)
        .then(res => res.json())
        .then(resData => {
          if (resData.success && resData.detail) {
            setData(resData.detail);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, employeeId, employeeName]);

  if (!isOpen) return null;

  const quartersList = [
    { key: 'Q1', title: 'Q1 · Jan–Mar' },
    { key: 'Q2', title: 'Q2 · Apr–Jun' },
    { key: 'Q3', title: 'Q3 · Jul–Sep' },
    { key: 'Q4', title: 'Q4 · Oct–Dec' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {data?.employeeName || employeeName || 'Employee'}
              </h3>
              <p className="text-xs text-slate-400">Complete quarterly leave summary view</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading quarterly records...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {quartersList.map(q => {
                const qDetail = data?.quarters[q.key] || {
                  label: q.title,
                  casual: 0,
                  planned: 0,
                  total: 0,
                  remaining: 6,
                  extra: 0,
                };
                const isCurrent = q.key === currentQuarter;

                return (
                  <div
                    key={q.key}
                    className={`rounded-2xl p-4 border transition-all ${
                      isCurrent
                        ? 'bg-blue-950/40 border-blue-500/50 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
                      <h4 className="font-bold text-xs text-white">{q.title}</h4>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Casual Used:</span>
                        <strong className="text-amber-400 font-mono">{qDetail.casual}</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Planned Used:</span>
                        <strong className="text-purple-400 font-mono">{qDetail.planned}</strong>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800/60 pt-1.5 text-slate-300 font-medium">
                        <span>Total Used:</span>
                        <strong className="text-white font-mono font-bold">{qDetail.total}</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 font-medium">
                        <span>Remaining:</span>
                        <strong className="text-emerald-400 font-mono font-bold">{qDetail.remaining}</strong>
                      </div>
                      <div className="flex justify-between items-start text-slate-400">
                        <span>Extra Deduct:</span>
                        {qDetail.extra > 0 ? (
                          <div className="text-right">
                            <strong className="text-red-400 font-mono font-bold block">
                              {qDetail.extra} Day(s)
                            </strong>
                            {qDetail.monthText && (
                              <span className="text-[10px] text-rose-300 font-semibold block">
                                ({qDetail.monthText})
                              </span>
                            )}
                          </div>
                        ) : (
                          <strong className="text-slate-500 font-mono">0</strong>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
