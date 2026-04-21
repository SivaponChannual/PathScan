import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fetchAllRainfalls } from '../api';
import styles from './TransparencyChart.module.css';

const MATERIAL_COLOR = {
  GLASS:   '#3b82f6',
  ACRYLIC: '#8b5cf6',
  METAL:   '#f59e0b',
  PLYWOOD: '#10b981',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  return (
    <div className={styles.tooltip}>
      <p className={styles.ttYear}>Angle: {label}°</p>
      <p className={styles.ttVal}>
        {payload[0].value.toFixed(2)} <span>index</span>
      </p>
      {entry?.materialType && (
        <p className={styles.ttMaterial} style={{ color: MATERIAL_COLOR[entry.materialType] }}>
          {entry.materialType}
        </p>
      )}
    </div>
  );
};

export default function TransparencyChart({ basin, viewMode, onDataLoaded }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!basin) return;
    setLoading(true);
    setError(null);
    fetchAllRainfalls(basin.basinId)
      .then(records => {
        const sorted = [...records].sort((a, b) => a.angle - b.angle);
        const mapped = sorted.map(r => ({
          angle: String(r.angle),
          transparencyIndex: r.transparencyIndex,
          materialType: r.materialType ?? null,
        }));
        setData(mapped);
        onDataLoaded?.(mapped);
      })
      .catch(() => setError('Failed to load transparency index'))
      .finally(() => setLoading(false));
  }, [basin]);

  if (!basin)  return <div className={styles.empty}>Select a session to view transparency index</div>;
  if (loading) return <div className={styles.empty}>Loading...</div>;
  if (error)   return <div className={styles.empty} style={{ color: 'var(--danger)' }}>{error}</div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.chartHeader}>
        <div>
          <h2 className={styles.title}>Transparency Index — {basin.name}</h2>
          <p className={styles.sub}>
            {basin.region} · Index &gt; 0.5 suggests glass or transparent material
          </p>
        </div>
        <div className={styles.materialLegend}>
          {Object.entries(MATERIAL_COLOR).map(([mat, color]) => (
            <span
              key={mat}
              className={styles.matTag}
              style={{ background: `${color}22`, color, borderColor: `${color}55` }}
            >
              {mat}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="angle"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false} tickLine={false}
            tickFormatter={v => `${v}°`}
          />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            axisLine={false} tickLine={false}
            domain={[0, 1]}
            tickFormatter={v => Number(v).toFixed(1)}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(56,189,248,0.07)' }} />
          <Bar dataKey="transparencyIndex" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.materialType ? MATERIAL_COLOR[entry.materialType] : 'var(--accent2)'}
                opacity={entry.transparencyIndex > 0.5 ? 1 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}