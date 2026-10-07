#!/usr/bin/env node
// Standalone screenshot retention cleanup — for a Hostinger cron job (hPanel → Advanced → Cron Jobs):
//   cd /path/to/app && node scripts/cleanup_screenshots.js
// The running app also cleans up hourly on its own; this is a backup for when the
// Node process is idle/stopped. Only screenshot files + their index rows are deleted,
// never attendance or time entries.
const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');
const ROOT = process.env.SCREENSHOT_DIR || path.join(APP_DIR, 'data', 'screenshots');
const SAFE = /^[A-Za-z0-9_-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RETENTION_POLICY_VERSION = 2;

function retentionDays() {
  try {
    const db = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'data', 'db.json'), 'utf-8'));
    const s = db.timeTrackingSettings || {};
    const d = Number(s.screenshotRetentionDays);
    if (s.retentionPolicyVersion === RETENTION_POLICY_VERSION && Number.isInteger(d) && d >= 1 && d <= 365) return d;
  } catch {}
  return 7;
}

function readIndex(dir) {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf-8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function main() {
  const days = retentionDays();
  const cutoffMs = Date.now() - days * 24 * 3600000;
  const cutoffDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(cutoffMs));
  let shots = 0;
  let folders = 0;
  if (!fs.existsSync(ROOT)) {
    console.log(`[cleanup] no screenshot folder at ${ROOT}`);
    return;
  }
  for (const emp of fs.readdirSync(ROOT)) {
    const empDir = path.join(ROOT, emp);
    if (!SAFE.test(emp) || !fs.statSync(empDir).isDirectory()) continue;
    for (const day of fs.readdirSync(empDir)) {
      const dir = path.join(empDir, day);
      if (!DATE.test(day) || !fs.statSync(dir).isDirectory() || day > cutoffDay) continue;
      const list = readIndex(dir);
      const keep = day < cutoffDay ? [] : list.filter(s => new Date(s.takenAt).getTime() >= cutoffMs);
      if (keep.length === list.length && day === cutoffDay) continue;
      if (keep.length === 0) {
        fs.rmSync(dir, { recursive: true, force: true });
        folders++;
      } else {
        list.filter(s => !keep.includes(s)).forEach(s => {
          for (const f of [`${s.id}.jpg`, `${s.id}_thumb.jpg`]) {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          }
        });
        const tmp = path.join(dir, `index.json.${process.pid}.tmp`);
        fs.writeFileSync(tmp, JSON.stringify(keep));
        fs.renameSync(tmp, path.join(dir, 'index.json'));
      }
      shots += list.length - keep.length;
    }
    if (fs.readdirSync(empDir).length === 0) fs.rmdirSync(empDir);
  }
  console.log(`[cleanup] retention ${days} days: deleted ${shots} screenshot(s), ${folders} day folder(s) older than ${new Date(cutoffMs).toISOString()}`);
}

main();
