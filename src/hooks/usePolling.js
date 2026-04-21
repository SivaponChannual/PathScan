/**
 * usePolling — polls the scan endpoint for live 360° point cloud data
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchScan } from '../api';

const POLL_INTERVAL_MS = 4000;

export function usePolling(sessionName) {
  const [scanData, setScanData] = useState(null);
  const [status,   setStatus]   = useState('idle');
  const timerRef   = useRef(null);

  const fetchLatest = useCallback(async () => {
    if (!sessionName) return;
    try {
      const data = await fetchScan(sessionName);
      setScanData(data);
      setStatus('polling');
    } catch {
      setStatus('error');
    }
  }, [sessionName]);

  useEffect(() => {
    if (!sessionName) {
      setScanData(null);
      setStatus('idle');
      return;
    }

    setScanData(null);
    setStatus('polling');
    fetchLatest();
    timerRef.current = setInterval(fetchLatest, POLL_INTERVAL_MS);

    return () => clearInterval(timerRef.current);
  }, [sessionName, fetchLatest]);

  return { scanData, status };
}