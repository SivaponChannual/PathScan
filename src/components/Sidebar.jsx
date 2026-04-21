import { useEffect, useState } from 'react';
import { fetchSessions } from '../api';
import styles from './Sidebar.module.css';

export default function Sidebar({ selected, onSelect }) {
  const [sessions, setSessions] = useState([]);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setError('Could not load scan sessions'));
  }, []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.drop}>🛰️</span>
        <span>Path<b>Scan</b></span>
      </div>

      <p className={styles.label}>SCAN SESSIONS</p>

      {error && <p className={styles.err}>{error}</p>}

      <nav>
        {sessions.map((s, i) => (
          <button
            key={s.name ?? i}
            className={`${styles.item} ${selected?.name === s.name ? styles.active : ''}`}
            onClick={() => onSelect(s)}
          >
            <span className={styles.name}>{s.name}</span>
            <span className={styles.region}>{s.pointCount} readings</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
