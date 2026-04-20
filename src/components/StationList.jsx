import { useEffect, useState } from 'react';
import { fetchStations } from '../api';
import styles from './StationList.module.css';

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

  if (!basin)   return null;
  if (loading)  return <p className={styles.muted}>Loading sensor array...</p>;

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Sensor Array in {basin.name}</h3>
      <div className={styles.grid}>
        {stations.map(s => (
          <div key={s.stationId} className={styles.card}>
            <span className={styles.sid}>#{s.stationId}</span>
            <p className={styles.name}>{s.name}</p>
            {s.latitude != null && (
              <p className={styles.coords}>
                {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
