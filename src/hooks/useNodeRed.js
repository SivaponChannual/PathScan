import { useEffect, useRef, useState } from 'react';

// Connects to Node-RED WebSocket endpoint.
// Node-RED must have a WebSocket-out node configured at /ws/pathscan
const WS_URL = 'ws://localhost:1880/ws/pathscan';
const MAX_MESSAGES = 50;
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export function useNodeRed() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus]     = useState('disconnected'); // connecting | connected | disconnected | error | mock
  const wsRef = useRef(null);
  const mockTimerRef = useRef(null);

  useEffect(() => {
    function startMockFeed() {
      setStatus('mock');
      mockTimerRef.current = setInterval(() => {
        const sample = {
          primaryDistCm: Number((20 + Math.random() * 130).toFixed(1)),
          frontShortCm: Number((4 + Math.random() * 26).toFixed(1)),
          rearShortCm: Number((4 + Math.random() * 26).toFixed(1)),
          ultrasonicCm: Number((15 + Math.random() * 150).toFixed(1)),
          transparencyIndex: Number(Math.random().toFixed(2)),
          isGlass: Math.random() > 0.65,
        };
        setMessages((prev) => [
          { id: Date.now(), time: new Date().toLocaleTimeString(), data: sample },
          ...prev.slice(0, MAX_MESSAGES - 1),
        ]);
      }, 1200);
    }

    function connect() {
      setStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen  = () => setStatus('connected');
      ws.onclose = () => {
        wsRef.current = null;
        if (USE_MOCK && !mockTimerRef.current) startMockFeed();
        else setStatus('disconnected');
      };
      ws.onerror = () => {
        if (USE_MOCK && !mockTimerRef.current) startMockFeed();
        else setStatus('error');
      };

      ws.onmessage = (e) => {
        let parsed;
        try   { parsed = JSON.parse(e.data); }
        catch { parsed = { raw: e.data };    }

        setMessages(prev => [
          { id: Date.now(), time: new Date().toLocaleTimeString(), data: parsed },
          ...prev.slice(0, MAX_MESSAGES - 1),
        ]);
      };
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (mockTimerRef.current) clearInterval(mockTimerRef.current);
    };
  }, []);

  function reconnect() {
    wsRef.current?.close();
    if (mockTimerRef.current) {
      clearInterval(mockTimerRef.current);
      mockTimerRef.current = null;
    }
    setStatus('disconnected');
    setMessages([]);
  }

  return { messages, status, reconnect };
}
