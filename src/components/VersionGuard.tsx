'use client';

import { useEffect, useRef } from 'react';

export default function VersionGuard() {
  const initialVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkVersion() {
      try {
        const res = await fetch('/api/version', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.version || !isMounted) return;

        if (!initialVersionRef.current) {
          initialVersionRef.current = data.version;
        } else if (initialVersionRef.current !== data.version) {
          console.warn('[HRM Pilot] Updated server build detected. Reloading for latest features...');
          // Give pending actions 1.5 seconds or reload immediately
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } catch (e) {
        // Ignore offline or fetch abort
      }
    }

    // 1. Initial check after 3 seconds of load
    const initialTimer = setTimeout(checkVersion, 3000);

    // 2. Tab focus listener (when employee returns to HRM Pilot tab)
    const handleFocus = () => {
      checkVersion();
    };
    window.addEventListener('focus', handleFocus);

    // 3. Catch dynamic chunk load errors and automatically reload
    const handleError = (e: ErrorEvent) => {
      const msg = e?.message || '';
      if (msg.includes('Loading chunk') || msg.includes('ChunkLoadError') || msg.includes('Failed to fetch dynamically imported module')) {
        console.warn('[HRM Pilot] Stale chunk error caught. Reloading application...');
        window.location.reload();
      }
    };
    window.addEventListener('error', handleError);

    // 4. Background check every 3 minutes
    const interval = setInterval(checkVersion, 3 * 60 * 1000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
