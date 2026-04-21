import { useEffect, useState } from 'react';
import { fetchStations } from '../api';
import styles from './StationList.module.css';

const TYPE_META = {
  IR_SHORT:   { icon: '🔴', label: 'Short-Range IR',  color: '#10b981' },
  IR_LONG:    { icon: '🟣', label: 'Long-Range IR',   color: '#6366f1' },
  ULTRASONIC: { icon: '🔵', label: 'Ultrasonic',      color: '#3b82f6' },
};

export default function StationList({ basin }) {
  const [stations, setStations] = useState([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!basin) return;
    setLoading(true);
    fetchStations(basin.basinId)
      .then(setStations)
      .finally(() => setLoading(false));
  }, [basin]);

  if (!basin)  return null;
  if (loading) return <p className={styles.muted}>Loading sensor array...</p>;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Sensor Array — {basin.name}</h3>
      <div className={styles.grid}>
        {stations.map(s => {
          const meta = TYPE_META[s.type] ?? { icon: '⚪', label: s.type ?? 'Sensor', color: 'var(--muted)' };
          return (
            <div key={s.stationId} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.icon}>{meta.icon}</span>
                <span className={styles.sid}>#{s.stationId}</span>
              </div>
              <p className={styles.name}>{s.name}</p>
              <p className={styles.typeLabel} style={{ color: meta.color }}>{meta.label}</p>
              {s.rangeNote && <p className={styles.range}>Range: {s.rangeNote}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}