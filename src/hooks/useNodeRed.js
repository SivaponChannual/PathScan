import { useEffect, useRef, useState } from 'react';

// Connects to Node-RED WebSocket endpoint.
// Node-RED must have a WebSocket-out node configured at /ws/rain
const WS_URL = 'ws://localhost:1880/ws/rain';
const MAX_MESSAGES = 50;

export function useNodeRed() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus]     = useState('disconnected'); // connecting | connected | disconnected | error
  const wsRef = useRef(null);

  useEffect(() => {
    function connect() {
      setStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen  = () => setStatus('connected');
      ws.onclose = () => { setStatus('disconnected'); wsRef.current = null; };
      ws.onerror = () => setStatus('error');

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
    return () => wsRef.current?.close();
  }, []);

  function reconnect() {
    wsRef.current?.close();
    setMessages([]);
  }

  return { messages, status, reconnect };
}
