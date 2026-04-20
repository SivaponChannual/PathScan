import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchAllRainfalls } from '../api';
import styles from './RainfallChart.module.css';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.ttYear}>Segment {label}deg</p>
      <p className={styles.ttVal}>{payload[0].value.toFixed(2)} <span>index</span></p>
    </div>
  );
};

export default function RainfallChart({ basin, viewMode }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!basin) return;
    setLoading(true);
    setError(null);
    fetchAllRainfalls(basin.basinId)
      .then(records => {
        const sorted = [...records].sort((a, b) => a.year - b.year);
        setData(sorted.map(r => ({ year: String(r.year), rainfall: r.rainfall })));
      })
      .catch(() => setError('Failed to load transparency index'))
      .finally(() => setLoading(false));
  }, [basin]);

  if (!basin) return <div className={styles.empty}>Select a session to view transparency index</div>;
  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error)   return <div className={styles.empty} style={{ color: 'var(--danger)' }}>{error}</div>;

  const max = Math.max(...data.map(d => d.rainfall));

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>{viewMode} Transparency Map — {basin.name}</h2>
      <p className={styles.sub}>
        {basin.region} · Higher index suggests light/sound reflection mismatch (possible glass)
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false} tickLine={false}
            domain={[0, 1]}
            tickFormatter={v => Number(v).toFixed(1)}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.07)' }} />
          <Bar dataKey="rainfall" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.rainfall === max ? 'var(--accent)' : 'var(--accent2)'}
                opacity={entry.rainfall === max ? 1 : 0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
