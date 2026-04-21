import { useEffect, useRef, useState, useCallback } from 'react';

const POLL_INTERVAL_MS = 3000;
const MAX_READINGS     = 50;
const USE_MOCK         = false;
const BASE             = '/pathscan-api/v1';

export function usePolling(sessionId) {
  const [readings, setReadings] = useState([]);
  const [status,   setStatus]   = useState('idle');
  const timerRef   = useRef(null);
  const lastTsRef  = useRef(null);

  const fetchLatest = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res  = await fetch(`${BASE}/sessions/${sessionId}/readings/latest`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      // Only add if timestamp is new
      if (data.timestamp === lastTsRef.current) return;
      lastTsRef.current = data.timestamp;

      setReadings(prev => [
        { id: Date.now(), time: new Date().toLocaleTimeString(), data },
        ...prev.slice(0, MAX_READINGS - 1),
      ]);
      setStatus('polling');
    } catch {
      setStatus('error');
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setReadings([]);
      setStatus('idle');
      lastTsRef.current = null;
      return;
    }

    // Reset when session changes
    setReadings([]);
    lastTsRef.current = null;
    setStatus('polling');

    fetchLatest();
    timerRef.current = setInterval(fetchLatest, POLL_INTERVAL_MS);

    return () => clearInterval(timerRef.current);
  }, [sessionId, fetchLatest]);

  const latest = readings[0]?.data ?? {};
  return { readings, latest, status };
}