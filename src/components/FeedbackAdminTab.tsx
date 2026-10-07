'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquareQuote,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  LifeBuoy,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Image as ImageIcon,
  Trash2,
  MessageCircle,
  ExternalLink,
  X,
  Send,
  User,
  Building,
  Check,
  ChevronDown,
} from 'lucide-react';
import { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/lib/types';

export default function FeedbackAdminTab() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | FeedbackCategory>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | FeedbackStatus>('All');

  // Reply Modal
  const [replyModalItem, setReplyModalItem] = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<FeedbackStatus>('In Review');
  const [savingReply, setSavingReply] = useState(false);

  // Lightbox Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Delete Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchItems = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch(`/api/feedback?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        setError('');
      } else if (!isSilent) {
        setError(data.error || 'Failed to fetch feedback records');
      }
    } catch (err: any) {
      if (!isSilent) setError(err.message || 'Error loading feedback records');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(false);

    // Live background polling every 5 seconds so new submissions and changes sync automatically
    const pollInterval = setInterval(() => {
      fetchItems(true);
    }, 5000);

    const onFocus = () => fetchItems(true);
    const onFeedbackUpdate = () => fetchItems(true);

    window.addEventListener('focus', onFocus);
    window.addEventListener('feedbackUpdated', onFeedbackUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('feedbackUpdated', onFeedbackUpdate);
    };
  }, []);

  const handleUpdateStatus = async (item: FeedbackItem, newStatus: FeedbackStatus) => {
    const prevStatus = item.status;
    const prevResolvedAt = item.resolvedAt;

    // 1. Instant 0ms optimistic UI update (changes dropdown value immediately without waiting)
    setItems(prev =>
      prev.map(f =>
        f.id === item.id
          ? {
              ...f,
              status: newStatus,
              resolvedAt: newStatus === 'Resolved' ? new Date().toISOString() : f.resolvedAt,
              updatedAt: new Date().toISOString(),
            }
          : f
      )
    );
    showFlash(`Status updated to "${newStatus}"`);

    try {
      const res = await fetch(`/api/feedback?_t=${Date.now()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Server rejected status update');
      }

      if (data.item) {
        setItems(prev => prev.map(f => (f.id === item.id ? { ...f, ...data.item } : f)));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('feedbackUpdated'));
      }
    } catch (e: any) {
      console.error('Failed to update status on server:', e);
      // Revert optimistic update on failure
      setItems(prev =>
        prev.map(f =>
          f.id === item.id
            ? { ...f, status: prevStatus, resolvedAt: prevResolvedAt }
            : f
        )
      );
      showFlash(`Error: Could not save status to server.`);
    }
  };

  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyModalItem) return;

    const currentItem = replyModalItem;
    const prevStatus = currentItem.status;
    const prevResponse = currentItem.adminResponse;
    const prevResolvedAt = currentItem.resolvedAt;

    // 1. Instant 0ms optimistic UI update & close modal right away
    setItems(prev =>
      prev.map(f =>
        f.id === currentItem.id
          ? {
              ...f,
              status: replyStatus,
              adminResponse: replyText,
              resolvedAt: replyStatus === 'Resolved' ? new Date().toISOString() : f.resolvedAt,
              updatedAt: new Date().toISOString(),
            }
          : f
      )
    );
    setReplyModalItem(null);
    showFlash('Response sent to employee successfully.');

    setSavingReply(true);
    try {
      const res = await fetch(`/api/feedback?_t=${Date.now()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentItem.id,
          status: replyStatus,
          adminResponse: replyText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save response');
      }

      if (data.item) {
        setItems(prev => prev.map(f => (f.id === currentItem.id ? { ...f, ...data.item } : f)));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('feedbackUpdated'));
      }
    } catch (e: any) {
      console.error('Error updating feedback:', e);
      // Revert on failure
      setItems(prev =>
        prev.map(f =>
          f.id === currentItem.id
            ? {
                ...f,
                status: prevStatus,
                adminResponse: prevResponse,
                resolvedAt: prevResolvedAt,
              }
            : f
        )
      );
      alert('Error updating feedback: ' + (e.message || 'Server error'));
    } finally {
      setSavingReply(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic removal
    const previousItems = items;
    setItems(prev => prev.filter(f => f.id !== id));
    setDeleteConfirmId(null);
    showFlash('Record deleted.');

    try {
      const res = await fetch(`/api/feedback?id=${id}&_t=${Date.now()}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete record');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('feedbackUpdated'));
      }
    } catch (e: any) {
      // Revert on failure
      setItems(previousItems);
      alert('Failed to delete item: ' + e.message);
    }
  };

  const showFlash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 4000);
  };

  // Metrics
  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter(i => i.status === 'Pending').length;
    const inReview = items.filter(i => i.status === 'In Review').length;
    const resolved = items.filter(i => i.status === 'Resolved').length;
    const complaints = items.filter(i => i.category === 'Complaint').length;
    return { total, pending, inReview, resolved, complaints };
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const empName = (item.employeeName || '').toLowerCase();
        const empEmail = (item.employeeEmail || '').toLowerCase();
        const dept = (item.department || '').toLowerCase();
        const sub = (item.subject || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        if (!empName.includes(q) && !empEmail.includes(q) && !dept.includes(q) && !sub.includes(q) && !desc.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, categoryFilter, statusFilter, search]);

  const getCategoryBadge = (cat: FeedbackCategory) => {
    switch (cat) {
      case 'Complaint':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-400" />
            Complaint
          </span>
        );
      case 'Suggestion':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Lightbulb className="w-3 h-3 mr-1 text-emerald-400" />
            Suggestion
          </span>
        );
      case 'Feedback':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <MessageSquare className="w-3 h-3 mr-1 text-blue-400" />
            Feedback
          </span>
        );
      case 'Support':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <LifeBuoy className="w-3 h-3 mr-1 text-amber-400" />
            Help / Support
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>Admin Control Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tight">
            Employee Feedback & Complaints Desk
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review grievances, support tickets, suggestions, and feedback submitted by employees across departments.
          </p>
        </div>
        <button
          onClick={fetchItems}
          className="self-start sm:self-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center space-x-2 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Records</span>
        </button>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* METRIC STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-sm">
          <p className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Total Submissions</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-slate-900/90 border border-amber-500/30 p-4 rounded-2xl shadow-sm bg-amber-500/5">
          <p className="text-[11px] text-amber-400 uppercase font-bold tracking-wider flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            Pending Action
          </p>
          <p className="text-2xl font-black text-amber-300 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-slate-900/90 border border-blue-500/30 p-4 rounded-2xl shadow-sm bg-blue-500/5">
          <p className="text-[11px] text-blue-400 uppercase font-bold tracking-wider flex items-center">
            <RefreshCw className="w-3 h-3 mr-1" />
            In Review
          </p>
          <p className="text-2xl font-black text-blue-300 mt-1">{stats.inReview}</p>
        </div>
        <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl shadow-sm bg-emerald-500/5">
          <p className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider flex items-center">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Resolved
          </p>
          <p className="text-2xl font-black text-emerald-300 mt-1">{stats.resolved}</p>
        </div>
        <div className="bg-slate-900/90 border border-rose-500/30 p-4 rounded-2xl shadow-sm bg-rose-500/5 col-span-2 sm:col-span-1">
          <p className="text-[11px] text-rose-400 uppercase font-bold tracking-wider flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Complaints
          </p>
          <p className="text-2xl font-black text-rose-300 mt-1">{stats.complaints}</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by employee name, department, keywords..."
              className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[40px]"
            />
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs text-slate-400 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 min-h-[40px] cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Review">In Review</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
          {(['All', 'Complaint', 'Suggestion', 'Feedback', 'Support'] as const).map(cat => {
            const isSel = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isSel
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {cat === 'All' ? 'All Categories' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* DATA VIEW */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-3" />
          <p className="text-sm font-semibold">Loading feedback submissions...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 text-center text-slate-500">
          <MessageSquareQuote className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-base font-bold text-slate-400">No submissions found</p>
          <p className="text-xs max-w-sm mx-auto mt-1">
            {search || categoryFilter !== 'All' || statusFilter !== 'All'
              ? 'Try adjusting your search criteria or category filter.'
              : 'When employees submit support requests or feedback, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* DESKTOP TABLE */}
          <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/80 text-slate-300 uppercase tracking-wider font-bold border-b border-slate-700/60">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Subject & Description</th>
                    <th className="px-4 py-3.5">Attachment</th>
                    <th className="px-4 py-3.5">Submitted</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      {/* Employee Info */}
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {item.employeeName?.charAt(0) || 'E'}
                          </div>
                          <div>
                            <p className="font-bold text-white text-xs">{item.employeeName}</p>
                            <p className="text-[11px] text-slate-400">{item.department || 'General'}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{item.employeeEmail}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4 align-top">
                        {getCategoryBadge(item.category)}
                      </td>

                      {/* Subject & Description */}
                      <td className="px-5 py-4 align-top max-w-md">
                        {item.subject && (
                          <p className="font-bold text-white text-xs mb-1">
                            {item.subject}
                          </p>
                        )}
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {item.description}
                        </p>
                        {item.adminResponse && (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25">
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">
                              Admin Note:
                            </p>
                            <p className="text-[11px] text-indigo-200">{item.adminResponse}</p>
                          </div>
                        )}
                      </td>

                      {/* Attachment */}
                      <td className="px-4 py-4 align-top">
                        {item.imageUrl ? (
                          <button
                            onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.subject || item.category })}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-[11px] font-semibold border border-slate-700 transition cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5 mr-1" />
                            <span>View Image</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">None</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 align-top whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Status Selector */}
                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <select
                          value={item.status}
                          onChange={e => handleUpdateStatus(item, e.target.value as FeedbackStatus)}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border transition cursor-pointer focus:outline-none ${
                            item.status === 'Resolved'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : item.status === 'In Review'
                              ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          <option value="Pending" className="bg-slate-900 text-amber-300">Pending</option>
                          <option value="In Review" className="bg-slate-900 text-blue-300">In Review</option>
                          <option value="Resolved" className="bg-slate-900 text-emerald-300">Resolved</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 align-top text-right whitespace-nowrap space-x-1.5">
                        <button
                          onClick={() => {
                            setReplyModalItem(item);
                            setReplyText(item.adminResponse || '');
                            setReplyStatus(item.status);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
                          title="Reply or add note"
                        >
                          <MessageCircle className="w-3.5 h-3.5 inline mr-1" />
                          <span>Reply</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                          title="Delete submission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE FEED (Clean vertical cards for small screens) */}
          <div className="lg:hidden space-y-3.5">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {item.employeeName?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <p className="font-bold text-white text-xs">{item.employeeName}</p>
                      <p className="text-[10px] text-slate-400">{item.department || 'General'}</p>
                    </div>
                  </div>
                  {getCategoryBadge(item.category)}
                </div>

                {/* Subject & Description */}
                <div>
                  {item.subject && (
                    <p className="font-bold text-white text-xs mb-1">
                      {item.subject}
                    </p>
                  )}
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {item.description}
                  </p>
                </div>

                {/* Attachment if present */}
                {item.imageUrl && (
                  <div>
                    <button
                      onClick={() => setPreviewImage({ url: item.imageUrl!, title: item.subject || item.category })}
                      className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-800 text-blue-400 text-xs font-semibold border border-slate-700"
                    >
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                      <span>View Screenshot</span>
                    </button>
                  </div>
                )}

                {/* Admin Note if present */}
                {item.adminResponse && (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                      Admin Response:
                    </p>
                    <p className="text-indigo-200">{item.adminResponse}</p>
                  </div>
                )}

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <select
                    value={item.status}
                    onChange={e => handleUpdateStatus(item, e.target.value as FeedbackStatus)}
                    className="text-xs font-bold rounded-lg px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-white focus:outline-none min-h-[36px]"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Review">In Review</option>
                    <option value="Resolved">Resolved</option>
                  </select>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setReplyModalItem(item);
                        setReplyText(item.adminResponse || '');
                        setReplyStatus(item.status);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center space-x-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REPLY MODAL */}
      {replyModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white font-heading">
                  Respond to {replyModalItem.employeeName}
                </h3>
                <p className="text-xs text-slate-400">
                  Category: {replyModalItem.category} • {replyModalItem.department}
                </p>
              </div>
              <button
                onClick={() => setReplyModalItem(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60 text-xs text-slate-300 max-h-36 overflow-y-auto">
              <p className="font-bold text-white mb-1">{replyModalItem.subject || 'Concern Details:'}</p>
              <p className="whitespace-pre-wrap">{replyModalItem.description}</p>
            </div>

            <form onSubmit={handleSaveReply} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Update Ticket Status
                </label>
                <select
                  value={replyStatus}
                  onChange={e => setReplyStatus(e.target.value as FeedbackStatus)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Review">In Review</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Resolution Note / Reply to Employee
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Explain what steps HR/Admin took, or provide an update directly to the employee..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-y"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyModalItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReply || !replyText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {savingReply ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Save & Send Response</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE PREVIEW LIGHTBOX */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>Attachment: {previewImage.title}</span>
              </h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[75vh] flex items-center justify-center">
              <img
                src={previewImage.url}
                alt="Full size attachment"
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                download
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center space-x-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in New Tab</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center text-rose-400">
              <Trash2 className="w-5 h-5 mr-2" />
              Confirm Deletion
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this feedback submission and any attached screenshot? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Delete Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
