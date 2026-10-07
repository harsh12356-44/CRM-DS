// Node-only part of instrumentation: schedules the screenshot retention cleanup
// once shortly after startup and then every hour.
import { getDbData } from './lib/store';
import { resolveTimeTrackingSettings } from './lib/timeTracking';
import { cleanupOldScreenshots } from './lib/screenshotStore';

const g = globalThis as typeof globalThis & { __screenshotCleanupTimer?: ReturnType<typeof setInterval> };

function run() {
  try {
    const days = resolveTimeTrackingSettings(getDbData().timeTrackingSettings).screenshotRetentionDays;
    cleanupOldScreenshots(days, undefined, { force: true });
  } catch (e) {
    console.warn('[screenshots] scheduled cleanup failed:', e);
  }
}

if (!g.__screenshotCleanupTimer) {
  setTimeout(run, 15 * 1000);
  g.__screenshotCleanupTimer = setInterval(run, 60 * 60 * 1000);
  g.__screenshotCleanupTimer.unref?.();
}
