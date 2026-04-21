import { useEffect, useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import styles from './SensorChart.module.css';

const MAX_POINTS = 30;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const irVal = payload.find(p => p.dataKey === 'ir')?.value;
  const usVal = payload.find(p => p.dataKey === 'us')?.value;
  const delta = irVal != null && usVal != null
    ? Math.abs(irVal - usVal).toFixed(1) : null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.ttTime}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={styles.ttRow} style={{ color: p.color }}>
          {p.name}: <b>{p.value} cm</b>
        </p>
      ))}
      {delta !== null && (
        <p className={styles.ttDelta}>
          Δ Delta: <b style={{ color: Number(delta) > 50 ? '#e11d48' : '#059669' }}>{delta} cm</b>
          {Number(delta) > 50 && <span className={styles.glassTag}>⚠ GLASS</span>}
        </p>
      )}
    </div>
  );
};

export default function SensorChart({ sessionId, polling }) {
  const { readings = [], latest = {} } = polling ?? {};
  const [series, setSeries]  = useState([]);
  const lastTsRef            = useRef(null);

  useEffect(() => {
    setSeries([]);
    lastTsRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    const r = readings[0];
    if (!r?.data?.primaryDistCm) return;
    if (r.data.timestamp === lastTsRef.current) return;
    lastTsRef.current = r.data.timestamp;

    setSeries(prev => {
      const point = {
        t:     r.time,
        ir:    r.data.primaryDistCm,
        us:    r.data.ultrasonicCm,
        front: r.data.frontShortCm,
        rear:  r.data.rearShortCm,
      };
      return [...prev.slice(-(MAX_POINTS - 1)), point];
    });
  }, [readings]);

  const delta   = latest.primaryDistCm != null && latest.ultrasonicCm != null
    ? Math.abs(latest.primaryDistCm - latest.ultrasonicCm).toFixed(1) : null;
  const isGlass = delta !== null && Number(delta) > 50;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Sensor Distance Feed</h2>
          <p className={styles.sub}>IR vs Ultrasonic · delta &gt; 50 cm triggers glass detection</p>
        </div>
        <div className={styles.pills}>
          <div className={styles.pill}>
            <span className={styles.pillLabel}>IR Primary</span>
            <span className={styles.pillVal} style={{ color: '#6366f1' }}>{latest.primaryDistCm ?? '—'} cm</span>
          </div>
          <div className={styles.pill}>
            <span className={styles.pillLabel}>Ultrasonic</span>
            <span className={styles.pillVal} style={{ color: '#3b82f6' }}>{latest.ultrasonicCm ?? '—'} cm</span>
          </div>
          <div className={`${styles.pill} ${isGlass ? styles.pillDanger : styles.pillOk}`}>
            <span className={styles.pillLabel}>Δ Delta</span>
            <span className={styles.pillVal}>{delta ?? '—'} cm</span>
          </div>
        </div>
      </div>

      {series.length === 0 ? (
        <div className={styles.empty}>Waiting for new sensor readings...</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} unit=" cm" width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line type="monotone" dataKey="ir"    name="Long-Range IR"  stroke="#6366f1" strokeWidth={2}   dot={false} />
            <Line type="monotone" dataKey="us"    name="Ultrasonic"     stroke="#3b82f6" strokeWidth={2}   dot={false} />
            <Line type="monotone" dataKey="front" name="Front Short IR" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="rear"  name="Rear Short IR"  stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}