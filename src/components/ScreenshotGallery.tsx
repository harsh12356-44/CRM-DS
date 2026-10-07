'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Camera, ChevronLeft, ChevronRight, X, Trash2, ExternalLink, RefreshCw, ImageOff } from 'lucide-react';
import { ScreenshotMeta, TimeActivity } from '@/lib/types';
import { activityColor, addDays, formatIstDate, formatIstTime, formatIstTimeWithSeconds, istDateKey } from '@/lib/timeTracking';

interface GalleryPayload {
  employeeId: string;
  date: string;
  screenshots: ScreenshotMeta[];
  dates: { date: string; count: number }[];
  config: { enabled: boolean; intervalMinutes: number };
  canDelete: boolean;
}

interface ScreenshotGalleryProps {
  employeeId: string;
  employeeName?: string;
  activities?: TimeActivity[];
  title?: string;
}

function imageUrl(s: ScreenshotMeta, thumb: boolean) {
  const p = new URLSearchParams({ employeeId: s.employeeId, date: s.date, id: s.id });
  if (thumb) p.set('thumb', '1');
  return `/api/time-tracking/screenshots/image?${p}`;
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function istHourLabel(iso: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date(iso))) % 24;
  const fmt = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
  return `${fmt(hour)} – ${fmt((hour + 1) % 24)}`;
}

export default function ScreenshotGallery({ employeeId, employeeName, activities = [], title }: ScreenshotGalleryProps) {
  const today = istDateKey();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<GalleryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (d: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/time-tracking/screenshots?employeeId=${encodeURIComponent(employeeId)}&date=${d}&t=${Date.now()}`, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to load screenshots.');
      setData(payload);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load screenshots.');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    setOpenIdx(null);
    load(date);
  }, [date, load]);

  // Live refresh for today's gallery: on every new capture from this browser, and every minute.
  useEffect(() => {
    if (date !== today) return;
    const onShot = () => load(date, true);
    window.addEventListener('screenshotCaptured', onShot);
    const poll = setInterval(() => load(date, true), 60000);
    return () => {
      window.removeEventListener('screenshotCaptured', onShot);
      clearInterval(poll);
    };
  }, [date, today, load]);

  const shots = data?.date === date ? data.screenshots : [];
  const open = openIdx !== null ? shots[openIdx] : null;

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null);
      if (e.key === 'ArrowRight') setOpenIdx(i => (i !== null && i < shots.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setOpenIdx(i => (i !== null && i > 0 ? i - 1 : i));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openIdx, shots.length]);

  const removeOpen = async () => {
    if (!open || !confirm('Delete this screenshot permanently?')) return;
    setDeleting(true);
    try {
      const p = new URLSearchParams({ employeeId: open.employeeId, date: open.date, id: open.id });
      const res = await fetch(`/api/time-tracking/screenshots?${p}`, { method: 'DELETE' });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Delete failed.');
      const nextLen = shots.length - 1;
      setOpenIdx(nextLen <= 0 ? null : Math.min(openIdx!, nextLen - 1));
      await load(date, true);
    } catch (err: any) {
      setError(err.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  // Group by IST hour for a scannable day view.
  const groups: { label: string; items: { s: ScreenshotMeta; idx: number }[] }[] = [];
  shots.forEach((s, idx) => {
    const label = istHourLabel(s.takenAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push({ s, idx });
    else groups.push({ label, items: [{ s, idx }] });
  });

  return (
    <div className="tt-root bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-white font-heading flex items-center space-x-2">
            <Camera className="w-4 h-4 text-purple-400" />
            <span>{title || (employeeName ? `${employeeName}'s Screenshots` : 'Screenshot Gallery')}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {data?.config.enabled
              ? `Captured every ${data.config.intervalMinutes} min while clocked in · times in IST`
              : 'Screenshots are currently turned off for this employee'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setDate(addDays(date, -1))} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer" aria-label="Previous day">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => e.target.value && setDate(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white [color-scheme:dark]"
            aria-label="Gallery date"
          />
          <button type="button" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer" aria-label="Next day">
            <ChevronRight className="w-4 h-4" />
          </button>
          {data && data.dates.length > 0 && (
            <select
              value=""
              onChange={e => e.target.value && setDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white max-w-[170px]"
              aria-label="Jump to a day with screenshots"
            >
              <option value="">Days with screenshots…</option>
              {data.dates.map(d => <option key={d.date} value={d.date}>{d.date} ({d.count})</option>)}
            </select>
          )}
          <button type="button" onClick={() => load(date)} className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 border-y border-slate-800 py-2">
        <span className="font-bold text-slate-200">{dayLabel(date)}</span>
        <span>{shots.length} screenshot{shots.length === 1 ? '' : 's'}</span>
        {shots.length > 0 && <span>{formatIstTime(shots[0].takenAt)} → {formatIstTime(shots[shots.length - 1].takenAt)}</span>}
      </div>

      {error && <p className="text-xs text-rose-300 font-semibold">{error}</p>}

      {!loading && shots.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <ImageOff className="w-7 h-7 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-500">No screenshots on this day.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.label} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{g.label} <span className="text-slate-600 font-bold normal-case">· {g.items.length}</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {g.items.map(({ s, idx }) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setOpenIdx(idx)}
                    className="group relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700 hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                    title={`${formatIstDate(s.takenAt)} ${formatIstTimeWithSeconds(s.takenAt)} IST · ${s.activity || ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(s, true)} alt={`Screenshot at ${formatIstTime(s.takenAt)}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <span className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-black/85 to-transparent text-[10px] font-bold text-white flex items-center justify-between gap-1">
                      <span className="text-left leading-tight">
                        <span className="block text-[9px] font-semibold text-slate-300">{formatIstDate(s.takenAt)}</span>
                        <span className="block tabular-nums">{formatIstTimeWithSeconds(s.takenAt)}</span>
                      </span>
                      {s.activity && <span className="w-2 h-2 rounded-full" style={{ background: activityColor(activities, s.activity) }} />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="tt-dark fixed inset-0 z-[70] flex flex-col bg-black/95" role="dialog" aria-label="Screenshot viewer">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">
                {(open.employeeName || employeeName) ? `${open.employeeName || employeeName}${open.employeeCode ? ` (${open.employeeCode})` : ''} · ` : ''}
                Date: {formatIstDate(open.takenAt)} · Time: {formatIstTimeWithSeconds(open.takenAt)} IST
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                Timestamp {open.takenAt}
                {open.entryId ? ` · Session ${open.entryId}${open.sessionClockIn ? ` (clock-in ${formatIstTime(open.sessionClockIn)})` : ''}` : ''}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {open.activity || '—'} · {open.width}×{open.height}
                {open.surface && open.surface !== 'monitor' ? ` · shared ${open.surface} only` : ''} · {openIdx! + 1} of {shots.length}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={imageUrl(open, false)} target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Open full size">
                <ExternalLink className="w-4 h-4" />
              </a>
              {data?.canDelete && (
                <button type="button" disabled={deleting} onClick={removeOpen} className="p-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 cursor-pointer" aria-label="Delete screenshot">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpenIdx(null)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative flex-1 min-h-0 flex items-center justify-center px-2 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(open, false)} alt={`Screenshot at ${formatIstTime(open.takenAt)}`} className="max-w-full max-h-full object-contain rounded-lg" />
            <button type="button" disabled={openIdx === 0} onClick={() => setOpenIdx(i => (i ? i - 1 : 0))} className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 cursor-pointer" aria-label="Previous screenshot">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" disabled={openIdx === shots.length - 1} onClick={() => setOpenIdx(i => (i !== null && i < shots.length - 1 ? i + 1 : i))} className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 cursor-pointer" aria-label="Next screenshot">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
