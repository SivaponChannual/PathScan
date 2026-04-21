import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { fetchReadings } from '../api';
import styles from './TransparencyChart.module.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.ttYear}>Servo: {label}°</p>
      {payload.map((p, i) => (
        <p key={i} className={styles.ttVal} style={{ color: p.color }}>
          {p.name}: <b>{p.value} cm</b>
        </p>
      ))}
    </div>
  );
};

export default function DistanceChart({ sessionName }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!sessionName) return;
    setLoading(true);
    setError(null);
    fetchReadings(sessionName)
      .then(rows => {
        const mapped = rows.map(r => ({
          angle: String(r.servo_angle_deg),
          front: r.front_dist_cm,
          rear:  r.rear_dist_cm,
        }));
        setData(mapped);
      })
      .catch(() => setError('Failed to load distance data'))
      .finally(() => setLoading(false));
  }, [sessionName]);

  if (!sessionName) return <div className={styles.empty}>Select a session to view distance chart</div>;
  if (loading)      return <div className={styles.empty}>Loading...</div>;
  if (error)        return <div className={styles.empty} style={{ color: 'var(--danger)' }}>{error}</div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.chartHeader}>
        <div>
          <h2 className={styles.title}>Distance by Servo Angle{sessionName ? ` — ${sessionName}` : ''}</h2>
          <p className={styles.sub}>
            Front & Rear IR distance per sweep step · red line = GP2Y0A41SK0F max range (40cm)
          </p>
        </div>
        <div className={styles.materialLegend}>
          <span className={styles.matTag} style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', borderColor: '#6366f155' }}>
            Front IR
          </span>
          <span className={styles.matTag} style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', borderColor: '#10b98155' }}>
            Rear IR
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="angle"
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}°`}
          />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false} tickLine={false}
            domain={[0, 45]}
            unit=" cm" width={50}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.07)' }} />
          <ReferenceLine y={40} stroke="rgba(239,68,68,0.4)" strokeDasharray="6 3" />
          <Bar dataKey="front" name="Front IR" fill="#6366f1" radius={[3, 3, 0, 0]} opacity={0.8} />
          <Bar dataKey="rear"  name="Rear IR"  fill="#10b981" radius={[3, 3, 0, 0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
