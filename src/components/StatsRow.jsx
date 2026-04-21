import { useMemo } from 'react';
import styles from './StatsRow.module.css';

export default function StatsRow({ sessionId, transparencyData, polling }) {
  const { latest = {}, status = 'idle' } = polling ?? {};

  const maxTi = transparencyData?.length
    ? Math.max(...transparencyData.map(d => d.transparencyIndex ?? 0)).toFixed(2)
    : '—';

  const material = latest.transparencyIndex != null
    ? latest.transparencyIndex > 0.7 ? { label: 'GLASS',   color: '#3b82f6', bg: '#eff6ff' }
    : latest.transparencyIndex > 0.4 ? { label: 'ACRYLIC', color: '#8b5cf6', bg: '#f5f3ff' }
    : latest.transparencyIndex > 0.2 ? { label: 'METAL',   color: '#f59e0b', bg: '#fffbeb' }
    :                                   { label: 'PLYWOOD', color: '#059669', bg: '#ecfdf5' }
    : null;

  const statusColor = status === 'polling' ? 'var(--success)'
    : status === 'error' ? 'var(--danger)' : 'var(--muted)';

  const cards = [
    {
      icon: '📡',
      label: 'Transparency Index',
      value: latest.transparencyIndex != null ? latest.transparencyIndex.toFixed(2) : '—',
      accent: latest.transparencyIndex > 0.5 ? 'var(--danger)' : 'var(--success)',
    },
    {
      icon: '🔍',
      label: 'Glass Detected',
      value: latest.isGlass ? '⚠ YES' : latest.isGlass === false ? 'NO' : '—',
      accent: latest.isGlass ? 'var(--danger)' : 'var(--success)',
    },
    {
      icon: '📏',
      label: 'Primary Distance',
      value: latest.primaryDistCm != null ? `${latest.primaryDistCm} cm` : '—',
      accent: 'var(--accent)',
    },
    {
      icon: '🔊',
      label: 'Ultrasonic Distance',
      value: latest.ultrasonicCm != null ? `${latest.ultrasonicCm} cm` : '—',
      accent: 'var(--accent2)',
    },
    {
      icon: '📐',
      label: 'Max TI (Session)',
      value: maxTi,
      accent: 'var(--text)',
    },
    {
      icon: '🧱',
      label: 'Material Detected',
      value: material?.label ?? '—',
      accent: material?.color ?? 'var(--muted)',
      bg: material?.bg,
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.statusBar}>
        <span className={styles.statusDot} style={{ background: statusColor }} />
        <span className={styles.statusText}>
          {status === 'polling' ? 'Live · polling database every 3s'
          : status === 'error'  ? 'Database unreachable'
          :                       'Waiting for session...'}
        </span>
      </div>
      <div className={styles.row}>
        {cards.map((c, i) => (
          <div key={i} className={styles.card} style={c.bg ? { background: c.bg } : {}}>
            <span className={styles.icon}>{c.icon}</span>
            <span className={styles.label}>{c.label}</span>
            <span className={styles.value} style={{ color: c.accent }}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}