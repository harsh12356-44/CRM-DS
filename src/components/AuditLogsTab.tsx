'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, User, FileText } from 'lucide-react';
import { AuditLogEntry } from '@/lib/types';

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    fetch('/api/audit-logs')
      .then(res => res.json())
      .then(data => setLogs(data || []))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-6 text-slate-100 pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          <span>System Audit Logs & Activity Trail</span>
        </h2>
        <p className="text-xs text-slate-400">Complete immutable audit record of administrative actions, payroll approvals, and punch corrections.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <th className="py-3.5 px-4">TIMESTAMP</th>
                <th className="py-3.5 px-4">ADMIN USER</th>
                <th className="py-3.5 px-4">ACTION PERFORMED</th>
                <th className="py-3.5 px-4">OBJECT TYPE</th>
                <th className="py-3.5 px-4">OBJECT ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-white font-sans">
                    {log.userName}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-blue-400 font-sans">
                    {log.action}
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    {log.objectType}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                    {log.objectId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
