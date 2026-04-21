import { useEffect, useState } from 'react';
import { fetchSensors } from '../api';
import styles from './StationList.module.css';

const TYPE_META = {
  IR_SHORT:   { icon: '🔴', label: 'Short-Range IR',  color: '#6366f1' },
  ULTRASONIC: { icon: '🔵', label: 'Ultrasonic',      color: '#3b82f6' },
  SERVO:      { icon: '⚙️', label: 'Servo Motor',     color: '#f59e0b' },
};

export default function StationList({ sessionName }) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionName) return;
    setLoading(true);
    fetchSensors(sessionName)
      .then(setSensors)
      .finally(() => setLoading(false));
  }, [sessionName]);

  if (!sessionName) return null;
  if (loading)      return <p className={styles.muted}>Loading sensor array...</p>;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Sensor Array — {sessionName}</h3>
      <div className={styles.grid}>
        {sensors.map(s => {
          const meta = TYPE_META[s.type] ?? { icon: '⚪', label: s.type ?? 'Sensor', color: 'var(--muted)' };
          return (
            <div key={s.sensorId} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.icon}>{meta.icon}</span>
                <span className={styles.sid}>#{s.sensorId}</span>
              </div>
              <p className={styles.name}>{s.name}</p>
              <p className={styles.typeLabel} style={{ color: meta.color }}>{meta.label}</p>
              {s.position  && <p className={styles.range}>Position: {s.position}</p>}
              {s.rangeNote && <p className={styles.range}>Range: {s.rangeNote}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}