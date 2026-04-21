import styles from './StatsRow.module.css';

export default function StatsRow({ sessionName, polling }) {
  const { scanData, status = 'idle' } = polling ?? {};
  const points = scanData?.points ?? [];

  // Compute stats from the point cloud
  const frontPoints   = points.filter(p => p.sensor === 'front');
  const rearPoints    = points.filter(p => p.sensor === 'rear');
  const obstacleCount = points.filter(p => p.is_obstacle).length;
  const clusterCount  = scanData?.clusters_found ?? 0;

  const avgFront = frontPoints.length
    ? (frontPoints.reduce((s, p) => s + p.dist_cm, 0) / frontPoints.length).toFixed(1)
    : '—';
  const avgRear = rearPoints.length
    ? (rearPoints.reduce((s, p) => s + p.dist_cm, 0) / rearPoints.length).toFixed(1)
    : '—';
  const maxDelta = frontPoints.length
    ? Math.max(...frontPoints.filter(p => p.ir_us_delta != null).map(p => p.ir_us_delta), 0).toFixed(1)
    : '—';

  const statusColor = status === 'polling' ? 'var(--success)'
    : status === 'error' ? 'var(--danger)' : 'var(--muted)';

  const cards = [
    {
      icon: '📡',
      label: 'Total Points',
      value: points.length || '—',
      accent: 'var(--accent)',
    },
    {
      icon: '🔴',
      label: 'Avg Front IR',
      value: avgFront !== '—' ? `${avgFront} cm` : '—',
      accent: '#6366f1',
    },
    {
      icon: '🟢',
      label: 'Avg Rear IR',
      value: avgRear !== '—' ? `${avgRear} cm` : '—',
      accent: '#10b981',
    },
    {
      icon: '🔊',
      label: 'Max IR-US Δ',
      value: maxDelta !== '—' ? `${maxDelta} cm` : '—',
      accent: Number(maxDelta) > 20 ? 'var(--danger)' : 'var(--accent2)',
    },
    {
      icon: '⚠️',
      label: 'Obstacles Found',
      value: obstacleCount || '0',
      accent: obstacleCount > 0 ? 'var(--danger)' : 'var(--success)',
    },
    {
      icon: '🗂️',
      label: 'DBSCAN Clusters',
      value: clusterCount,
      accent: 'var(--text)',
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.statusBar}>
        <span className={styles.statusDot} style={{ background: statusColor }} />
        <span className={styles.statusText}>
          {status === 'polling' ? 'Live · polling database every 4s'
          : status === 'error'  ? 'Database unreachable — using mock data'
          :                       'Waiting for session...'}
        </span>
      </div>
      <div className={styles.row}>
        {cards.map((c, i) => (
          <div key={i} className={styles.card}>
            <span className={styles.icon}>{c.icon}</span>
            <span className={styles.label}>{c.label}</span>
            <span className={styles.value} style={{ color: c.accent }}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}