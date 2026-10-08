'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  LifeBuoy,
  Upload,
  X,
  CheckCircle2,
  Clock,
  Send,
  Image as ImageIcon,
  MessageCircle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Info,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { FeedbackCategory, FeedbackItem, Employee } from '@/lib/types';

interface SupportFeedbackTabProps {
  employee: Employee;
}

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  badge: string;
  icon: any;
  desc: string;
  color: string;
  bgActive: string;
  borderActive?: string;
}[] = [
  {
    id: 'Complaint',
    label: 'Complaint',
    badge: 'Confidential & Urgent',
    icon: AlertTriangle,
    desc: 'Escalate workplace grievances, conflicts, or urgent issues directly to HR.',
    color: 'text-rose-400',
    bgActive: 'bg-rose-500/10 text-rose-300 border-rose-500/40 shadow-rose-950/30',
  },
  {
    id: 'Suggestion',
    label: 'Suggestion',
    badge: 'Ideas & Growth',
    icon: Lightbulb,
    desc: 'Share new ideas, process improvements, or enhancements for the team.',
    color: 'text-emerald-400',
    bgActive: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40 shadow-emerald-950/30',
  },
  {
    id: 'Feedback',
    label: 'Feedback',
    badge: 'Culture & Review',
    icon: MessageSquare,
    desc: 'Give constructive feedback regarding operations, tools, or policies.',
    color: 'text-blue-400',
    bgActive: 'bg-blue-500/10 text-blue-300 border-blue-500/40 shadow-blue-950/30',
  },
  {
    id: 'Support',
    label: 'Help / Support',
    badge: 'Technical & Admin',
    icon: LifeBuoy,
    desc: 'Request help with system access, software, attendance, or office supplies.',
    color: 'text-amber-400',
    bgActive: 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-amber-950/30',
  },
];

export default function SupportFeedbackTab({ employee }: SupportFeedbackTabProps) {
  const [category, setCategory] = useState<FeedbackCategory>('Support');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // History feed
  const [myItems, setMyItems] = useState<FeedbackItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Modal for previewing images
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMyHistory = async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingHistory(true);
      const res = await fetch(`/api/feedback?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setMyItems(data.items);
      }
    } catch (err) {
      console.warn('Failed to load feedback history:', err);
    } finally {
      if (!isSilent) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchMyHistory(false);

    // Silent background polling every 5s so employee sees status updates & Admin responses live without refreshing
    const pollInterval = setInterval(() => {
      fetchMyHistory(true);
    }, 5000);

    const onFocus = () => fetchMyHistory(true);
    const onFeedbackUpdate = () => fetchMyHistory(true);

    window.addEventListener('focus', onFocus);
    window.addEventListener('feedbackUpdated', onFeedbackUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('feedbackUpdated', onFeedbackUpdate);
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5 MB. Please select a smaller image.');
      return;
    }

    setErrorMsg('');
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!description.trim()) {
      setErrorMsg('Please enter a description for your request.');
      return;
    }

    setSubmitting(true);

    try {
      let imageBase64: string | undefined = undefined;
      if (imageFile && imagePreview) {
        imageBase64 = imagePreview;
      }

      const res = await fetch(`/api/feedback?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          imageBase64,
          imageName: imageFile?.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit request');
      }

      // 1. Immediately reflect the submitted item in history (0ms delay)
      if (data.item) {
        setMyItems(prev => [data.item, ...prev.filter(x => x.id !== data.item.id)]);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('feedbackUpdated'));
      }

      setSuccessMsg('Your submission has been received by HR and Admin. Thank you!');
      setSubject('');
      setDescription('');
      removeImage();
      fetchMyHistory(true);

      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryBadge = (cat: FeedbackCategory) => {
    switch (cat) {
      case 'Complaint':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Complaint</span>;
      case 'Suggestion':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Suggestion</span>;
      case 'Feedback':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Feedback</span>;
      case 'Support':
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Help / Support</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            Resolved
          </span>
        );
      case 'In Review':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-blue-400 animate-spin-slow" />
            In Review
          </span>
        );
      case 'Pending':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Pending HR Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* HEADER HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Employee Voice & Assistance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-heading">
              Help, Support & Feedback Desk
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
              We value your voice. Submit complaints, constructive feedback, innovative suggestions, or get technical and operational support directly from Management.
            </p>
          </div>
          <div className="hidden lg:flex items-center space-x-3 px-4 py-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold font-heading shadow-md">
              {employee.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-white">{employee.name}</p>
              <p className="text-[11px] text-slate-400">{employee.department} • {employee.employeeId || employee.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* SUBMISSION FORM */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
        <div>
          <h2 className="text-lg font-extrabold text-white font-heading flex items-center">
            <Send className="w-5 h-5 mr-2 text-blue-400" />
            Submit a New Request or Feedback
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose the category below and describe your concern. You can attach a screenshot or photo if applicable.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center space-x-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-semibold flex items-center space-x-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CATEGORY SELECTOR CARDS */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              1. Select Issue Category <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? `${cat.bgActive} shadow-lg ring-1 ring-white/10`
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/10' : 'bg-slate-800'}`}>
                        <Icon className={`w-5 h-5 ${cat.color}`} />
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-800 text-slate-400'}`}>
                        {cat.badge}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-0.5">{cat.label}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {cat.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SUBJECT INPUT */}
          <div className="space-y-2">
            <label htmlFor="feedback-subject" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              2. Brief Subject / Title <span className="text-slate-500 font-normal lowercase">(optional)</span>
            </label>
            <input
              id="feedback-subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Biometric punch error on 5th Oct, AC remote issue, ERP workflow improvement..."
              className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition min-h-[44px]"
            />
          </div>

          {/* DESCRIPTION TEXTAREA */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="feedback-desc" className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                3. Detailed Description <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-slate-500">
                {description.length} characters
              </span>
            </div>
            <textarea
              id="feedback-desc"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Please provide full details about your complaint, suggestion, feedback, or support request so HR can review and assist you promptly..."
              className="w-full bg-slate-800/70 border border-slate-700 rounded-xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition min-h-[120px] resize-y"
              required
            />
          </div>

          {/* IMAGE UPLOAD DROPZONE */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              4. Upload Image or Screenshot <span className="text-slate-500 font-normal lowercase">(optional, max 5 MB)</span>
            </label>

            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-2xl p-5 text-center cursor-pointer transition bg-slate-800/30 hover:bg-slate-800/60 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-200">
                  Click to browse or drop an image file here
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports PNG, JPG, JPEG, WEBP up to 5 MB
                </p>
              </div>
            ) : (
              <div className="relative inline-block border border-slate-700 bg-slate-800/80 rounded-2xl p-3 shadow-lg">
                <div className="flex items-center space-x-4">
                  <img
                    src={imagePreview}
                    alt="Uploaded attachment preview"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-700"
                  />
                  <div>
                    <p className="text-xs font-bold text-white max-w-[200px] truncate">
                      {imageFile?.name || 'Attached Image'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                    <div className="mt-2 flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setPreviewModalImg({ url: imagePreview, title: imageFile?.name || 'Preview' })}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Preview Full
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95 flex items-center justify-center space-x-2 min-h-[46px]"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting to HR...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit {category}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* MY SUBMISSION HISTORY */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-white font-heading flex items-center">
              <Clock className="w-5 h-5 mr-2 text-indigo-400" />
              My Submitted Requests & Status
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Track responses and updates from HR on your previous submissions
            </p>
          </div>
          <button
            onClick={() => fetchMyHistory(false)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
            <p className="text-xs">Loading your request history...</p>
          </div>
        ) : myItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-slate-400">No requests submitted yet</p>
            <p className="text-xs max-w-sm mx-auto">
              Whenever you submit feedback, suggestions, or complaints, you can monitor their progress and view HR responses right here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myItems.map(item => (
              <div
                key={item.id}
                className="bg-slate-800/40 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition shadow-md space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/40 pb-3">
                  <div className="flex items-center space-x-2">
                    {getCategoryBadge(item.category)}
                    {item.subject && (
                      <span className="text-sm font-bold text-white font-heading">
                        {item.subject}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(item.status)}
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {item.description}
                </p>

                {/* ATTACHMENT THUMBNAIL */}
                {item.imageUrl && (
                  <div className="pt-1 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModalImg({ url: item.imageUrl!, title: item.subject || item.category })}
                      className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition group cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-blue-400 group-hover:scale-110 transition" />
                      <span>View Attached Screenshot</span>
                    </button>
                  </div>
                )}

                {/* ADMIN RESPONSE / NOTE */}
                {item.adminResponse && (
                  <div className="mt-3 p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-1">
                    <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>HR & Admin Response</span>
                      {item.resolvedAt && (
                        <span className="text-[10px] text-indigo-300/70 font-normal">
                          • {new Date(item.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-200 font-medium whitespace-pre-wrap leading-relaxed pl-5">
                      {item.adminResponse}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LIGHTBOX MODAL FOR IMAGE PREVIEW */}
      {previewModalImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>Attachment: {previewModalImg.title}</span>
              </h3>
              <button
                onClick={() => setPreviewModalImg(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[75vh] flex items-center justify-center">
              <img
                src={previewModalImg.url}
                alt="Full size attachment"
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-slate-800"
              />
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end">
              <a
                href={previewModalImg.url}
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
    </div>
  );
}
