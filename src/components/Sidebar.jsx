import { useEffect, useState } from 'react';
import { fetchBasins } from '../api';
import styles from './Sidebar.module.css';

export default function Sidebar({ selected, onSelect }) {
  const [basins, setBasins] = useState([]);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    fetchBasins()
      .then(setBasins)
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
        {basins.map(b => (
          <button
            key={b.basinId}
            className={`${styles.item} ${selected?.basinId === b.basinId ? styles.active : ''}`}
            onClick={() => onSelect(b)}
          >
            <span className={styles.id}>#{b.basinId}</span>
            <span className={styles.name}>{b.name}</span>
            {b.region && <span className={styles.region}>{b.region}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
