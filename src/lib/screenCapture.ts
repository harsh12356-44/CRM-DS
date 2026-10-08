'use client';

// Browser-side screenshot capture for the Time Tracker.
//
// Browsers never allow silent screenshots: the employee must pick a screen in the
// "Share your screen" prompt (getDisplayMedia). We keep that stream alive for the whole
// session in this module-level singleton (so switching portal tabs doesn't drop it),
// grab a frame every N minutes while the tracker says WORKING, and upload a JPEG + thumbnail.

export interface CaptureState {
  sharing: boolean; // a screen-share stream is live
  surface?: string; // monitor | window | browser
  running: boolean; // tracker is WORKING and capture is scheduled
  lastAt?: number;
  count: number;
  error?: string;
  uploading: boolean;
}

type Listener = (s: CaptureState) => void;

const FULL_MAX_WIDTH = 1600;
const THUMB_WIDTH = 360;
const TICK_MS = 5000;
const FIRST_SHOT_DELAY_MS = 5000;

interface ImageCaptureLike {
  grabFrame(): Promise<ImageBitmap>;
}

class ScreenCaptureManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private worker: Worker | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private employeeId = '';
  private employeeName = '';
  private currentActivity = '';
  private intervalMs = 60000;
  private nextShotAt = 0;
  private inFlight = false;
  private listeners = new Set<Listener>();
  private state: CaptureState = { sharing: false, running: false, count: 0, uploading: false };

  get snapshot(): CaptureState {
    return this.state;
  }

  get isSupported(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
  }

  hasLiveStream(): boolean {
    return Boolean(this.stream && this.stream.getVideoTracks().some(t => t.readyState === 'live'));
  }

  isSharing(): boolean {
    return this.hasLiveStream();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => { this.listeners.delete(fn); };
  }

  private set(patch: Partial<CaptureState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(l => l(this.state));
  }

  // Must be called directly from a click handler (browsers require a user gesture).
  // Re-uses active stream without asking for permission again if already granted.
  async requestScreen(employeeId: string, employeeName?: string, activity?: string): Promise<boolean> {
    this.employeeId = employeeId;
    if (employeeName) this.employeeName = employeeName;
    if (activity) this.currentActivity = activity;

    if (this.hasLiveStream()) {
      this.set({ sharing: true, error: undefined });
      return true;
    }

    if (!this.isSupported) {
      this.set({ error: 'This browser cannot share the screen. Use Chrome or Edge on a computer.' });
      return false;
    }

    try {
      // Strongly prefer Entire System Screen (excludes current tab and prevents switching to tabs)
      const displayMediaOptions: any = {
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 5, max: 15 },
        },
        audio: false,
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'exclude',
        systemAudio: 'exclude',
        preferCurrentTab: false,
      };

      const stream = await (navigator.mediaDevices as any).getDisplayMedia(displayMediaOptions);
      const track = stream.getVideoTracks()[0];
      if (!track) {
        this.releaseStream('No video track available from screen share.');
        return false;
      }

      const surface = (track.getSettings() as { displaySurface?: string }).displaySurface;

      // Strict Company Policy: Only 'monitor' (Entire Screen) is allowed for WFH tracking.
      // If employee selected an application window or browser tab, immediately reject and terminate.
      if (surface && surface !== 'monitor') {
        const typeLabel = surface === 'browser' ? 'a browser tab' : 'an application window';
        track.stop();
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        this.stream = null;
        this.stopTicker();
        this.set({
          sharing: false,
          surface: undefined,
          error: `Company Policy: Work From Home tracking requires sharing your Entire Screen. You selected ${typeLabel}. Please clock in again and choose "Entire Screen".`,
        });
        return false;
      }

      track.addEventListener('ended', () => this.releaseStream('Screen sharing was stopped from browser controls. Screenshots are paused until you share again.'));
      this.stream = stream;
      this.set({
        sharing: true,
        surface,
        error: undefined,
      });
      this.nextShotAt = Date.now() + FIRST_SHOT_DELAY_MS;
      this.ensureTicker();
      return true;
    } catch (err: any) {
      const denied = err?.name === 'NotAllowedError';
      this.set({
        error: denied
          ? 'Screen sharing was cancelled or denied. Company policy requires sharing your Entire Screen to clock in.'
          : (err?.message || 'Could not start screen sharing.')
      });
      return false;
    }
  }

  // Called whenever the tracker status/config changes.
  // Note: Pausing on break does NOT release or stop the MediaStream, so resuming never re-prompts!
  setRunning(running: boolean, employeeId: string, intervalMinutes: number, meta?: { employeeName?: string; activity?: string }) {
    this.employeeId = employeeId;
    if (meta?.employeeName) this.employeeName = meta.employeeName;
    if (meta?.activity) this.currentActivity = meta.activity;

    const newInterval = Math.max(1, intervalMinutes) * 60000;
    if (newInterval !== this.intervalMs) {
      this.intervalMs = newInterval;
      if (this.state.lastAt) this.nextShotAt = this.state.lastAt + newInterval;
    }
    if (running && !this.state.running) {
      // Starting or resuming after a break: take one shortly, then follow the interval.
      this.nextShotAt = Math.min(this.nextShotAt || Infinity, Date.now() + FIRST_SHOT_DELAY_MS);
    }
    if (running !== this.state.running) this.set({ running });
    if (running) this.ensureTicker();
  }

  // Clock-out / tracker turned off / screenshots disabled completely.
  stop() {
    this.set({ running: false });
    this.releaseStream();
  }

  private releaseStream(message?: string) {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.stopTicker();
    this.set({ sharing: false, surface: undefined, error: message });
  }

  // A worker-driven tick keeps firing even when the tab is in the background
  // (main-thread timers get heavily throttled there).
  private ensureTicker() {
    if (this.worker || this.fallbackTimer) return;
    try {
      const src = `setInterval(() => postMessage('tick'), ${TICK_MS});`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      this.worker.onmessage = () => this.tick();
      URL.revokeObjectURL(url);
    } catch {
      this.fallbackTimer = setInterval(() => this.tick(), TICK_MS);
    }
  }

  private stopTicker() {
    this.worker?.terminate();
    this.worker = null;
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private tick() {
    if (!this.state.running || !this.stream || this.inFlight) return;
    if (Date.now() < this.nextShotAt) return;
    this.captureNow();
  }

  private async grabFrame(): Promise<CanvasImageSource & { width: number; height: number } | null> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track || track.readyState !== 'live') return null;
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture;
    if (IC) {
      try {
        return await new IC(track).grabFrame();
      } catch {}
    }
    // Fallback: draw from a hidden <video> element.
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
    const v = this.video;
    if (!v.videoWidth) return null;
    return Object.assign(v, { width: v.videoWidth, height: v.videoHeight });
  }

  // Generates JPEG with indelible Date & Time stamp banner drawn directly on the canvas image
  private toJpeg(
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    maxW: number,
    quality: number,
    meta?: { dateStr: string; timeStr: string; employeeName?: string; activity?: string }
  ): Promise<Blob | null> {
    const scale = Math.min(1, maxW / srcW);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    // DRAW WATERMARK BANNER (DATE, TIME, EMPLOYEE, ACTIVITY)
    if (meta) {
      const isThumb = maxW <= 400;
      const pad = isThumb ? 6 : 12;
      const fontSize = isThumb ? 9 : 13;
      const subFontSize = isThumb ? 8 : 11;
      const lineHeight = isThumb ? 11 : 18;

      const dateLine = `📅 ${meta.dateStr}  ⏰ ${meta.timeStr} IST`;
      const empLine = [meta.employeeName || 'Staff', meta.activity ? `• ${meta.activity}` : ''].filter(Boolean).join(' ');

      ctx.save();
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const m1 = ctx.measureText(dateLine);
      ctx.font = `600 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const m2 = ctx.measureText(empLine);

      const boxW = Math.min(canvas.width - pad * 2, Math.max(m1.width, m2.width) + (isThumb ? 16 : 28));
      const boxH = isThumb ? 28 : 46;
      const boxX = canvas.width - boxW - pad;
      const boxY = canvas.height - boxH - pad;
      const radius = isThumb ? 4 : 8;

      // Dark translucent pill with subtle purple border
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
      ctx.lineWidth = isThumb ? 1 : 1.5;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(boxX, boxY, boxW, boxH, radius);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      // Top line: Date and Time in crisp white
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(dateLine, boxX + (isThumb ? 8 : 14), boxY + (isThumb ? 4 : 6));

      // Bottom line: Employee name and activity in light purple
      ctx.fillStyle = '#d8b4fe';
      ctx.font = `600 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(empLine, boxX + (isThumb ? 8 : 14), boxY + (isThumb ? 4 : 6) + lineHeight);

      ctx.restore();
    }

    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async captureNow() {
    this.inFlight = true;
    this.nextShotAt = Date.now() + this.intervalMs;
    try {
      const frame = await this.grabFrame();
      if (!frame || !frame.width) return;
      // Read the size first: ImageBitmap.close() resets width/height to 0.
      const width = frame.width;
      const height = frame.height;

      const now = new Date();
      const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const timeStr = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(now);
      const meta = {
        dateStr,
        timeStr,
        employeeName: this.employeeName,
        activity: this.currentActivity,
      };

      const [full, thumb] = await Promise.all([
        this.toJpeg(frame, width, height, FULL_MAX_WIDTH, 0.6, meta),
        this.toJpeg(frame, width, height, THUMB_WIDTH, 0.55, meta),
      ]);
      if ('close' in frame && typeof frame.close === 'function') frame.close();
      if (!full || !thumb) return;

      this.set({ uploading: true });
      const form = new FormData();
      form.append('employeeId', this.employeeId);
      form.append('full', full, 'screen.jpg');
      form.append('thumb', thumb, 'thumb.jpg');
      form.append('width', String(width));
      form.append('height', String(height));
      form.append('surface', this.state.surface || '');
      const res = await fetch('/api/time-tracking/screenshots', { method: 'POST', body: form });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        this.set({ lastAt: Date.now(), count: this.state.count + 1, uploading: false, error: this.state.surface && this.state.surface !== 'monitor' ? this.state.error : undefined });
        window.dispatchEvent(new CustomEvent('screenshotCaptured'));
      } else {
        this.set({ uploading: false });
        if (res.status === 409) {
          // 409 means not clocked in yet or on a break. NEVER terminate the MediaStream!
          // Keep the stream alive and schedule retry in 15s.
          this.set({ error: payload.error || 'Screenshots paused.' });
          this.nextShotAt = Date.now() + 15000;
        } else if (res.status === 429) {
          this.set({ error: 'Screenshots throttled. Retrying shortly.' });
          this.nextShotAt = Date.now() + 60000;
        } else {
          this.set({ error: payload.error || 'Screenshot upload failed — will retry.' });
          this.nextShotAt = Date.now() + 20000;
        }
      }
    } catch {
      this.set({ uploading: false, error: 'Screenshot upload failed (network). Will retry.' });
      this.nextShotAt = Date.now() + 20000;
    } finally {
      this.inFlight = false;
    }
  }
}

let instance: ScreenCaptureManager | null = null;

export function getScreenCapture(): ScreenCaptureManager | null {
  if (typeof window === 'undefined') return null;
  if (!instance) instance = new ScreenCaptureManager();
  return instance;
}
