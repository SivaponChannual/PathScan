import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { fetchReadings } from '../api';
import styles from './SensorChart.module.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const front = payload.find(p => p.dataKey === 'front')?.value;
  const rear  = payload.find(p => p.dataKey === 'rear')?.value;
  const us    = payload.find(p => p.dataKey === 'us')?.value;
  return (
    <div className={styles.tooltip}>
      <p className={styles.ttTime}>Servo: {label}°</p>
      {payload.map((p, i) => (
        <p key={i} className={styles.ttRow} style={{ color: p.color }}>
          {p.name}: <b>{p.value} cm</b>
        </p>
      ))}
      {front != null && us != null && (
        <p className={styles.ttDelta}>
          Δ IR-US: <b style={{ color: Math.abs(front - us) > 20 ? '#ef4444' : '#059669' }}>
            {Math.abs(front - us).toFixed(1)} cm
          </b>
        </p>
      )}
    </div>
  );
};

export default function SensorChart({ sessionName }) {
  const [series,  setSeries]  = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionName) { setSeries([]); return; }
    setLoading(true);
    fetchReadings(sessionName)
      .then(rows => {
        const mapped = rows.map(r => ({
          angle: r.servo_angle_deg,
          front: r.front_dist_cm,
          rear:  r.rear_dist_cm,
          us:    r.ultrasonic_cm,
        }));
        setSeries(mapped);
      })
      .finally(() => setLoading(false));
  }, [sessionName]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Sensor Distance Feed</h2>
          <p className={styles.sub}>
            Front IR vs Rear IR vs Ultrasonic · per servo angle · red line = IR max range (40cm)
          </p>
        </div>
        <div className={styles.pills}>
          <div className={styles.pill}>
            <span className={styles.pillLabel}>Front IR</span>
            <span className={styles.pillVal} style={{ color: '#6366f1' }}>GP2Y0A41</span>
          </div>
          <div className={styles.pill}>
            <span className={styles.pillLabel}>Rear IR</span>
            <span className={styles.pillVal} style={{ color: '#10b981' }}>GP2Y0A41</span>
          </div>
          <div className={styles.pill}>
            <span className={styles.pillLabel}>Ultrasonic</span>
            <span className={styles.pillVal} style={{ color: '#3b82f6' }}>HC-SR04</span>
          </div>
        </div>
      </div>

      {series.length === 0 ? (
        <div className={styles.empty}>
          {loading ? 'Loading readings...' : 'Select a session to view sensor feed'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="angle" tick={{ fill: 'var(--muted)', fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `${v}°`}
            />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              axisLine={false} tickLine={false}
              unit=" cm" width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <ReferenceLine y={40} stroke="rgba(239,68,68,0.4)" strokeDasharray="6 3" label={{ value: 'IR max', fill: '#ef4444', fontSize: 10 }} />
            <Line type="monotone" dataKey="front" name="Front IR"    stroke="#6366f1" strokeWidth={2}   dot={false} />
            <Line type="monotone" dataKey="rear"  name="Rear IR"     stroke="#10b981" strokeWidth={2}   dot={false} />
            <Line type="monotone" dataKey="us"    name="Ultrasonic"  stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}