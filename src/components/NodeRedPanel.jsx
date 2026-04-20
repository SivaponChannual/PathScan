import { useNodeRed } from '../hooks/useNodeRed';
import styles from './NodeRedPanel.module.css';

const STATUS_COLOR = {
  connected:    'var(--success)',
  connecting:   '#facc15',
  disconnected: 'var(--muted)',
  error:        'var(--danger)',
  mock:         '#60a5fa',
};

export default function NodeRedPanel() {
  const { messages, status, reconnect } = useNodeRed();

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.dot} style={{ background: STATUS_COLOR[status] }} />
        <span className={styles.title}>Live Telemetry Stream (ESP32 / Node-RED)</span>
        <span className={styles.statusText}>{status}</span>
        {(status === 'disconnected' || status === 'error') && (
          <button className={styles.reconnect} onClick={reconnect}>Reconnect</button>
        )}
      </div>

      <div className={styles.feed}>
        {messages.length === 0 && (
          <p className={styles.empty}>Waiting for messages on ws://localhost:1880/ws/pathscan ...</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={styles.msg}>
            <span className={styles.time}>{m.time}</span>
            <span className={styles.payload}>{JSON.stringify(m.data)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
