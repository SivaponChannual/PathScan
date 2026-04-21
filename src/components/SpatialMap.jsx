import { useEffect, useRef } from 'react';
import styles from './SpatialMap.module.css';

const CANVAS_W = 700;
const CANVAS_H = 700;
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;
const MAX_RANGE = 40; // GP2Y0A41SK0F max cm
const SCALE = (Math.min(CANVAS_W, CANVAS_H) / 2 - 40) / MAX_RANGE;

/* ── Polar → Canvas 2D ─────────────────────────────────────────────────── */
function toCanvas(distCm, angleDeg) {
  // 0° = right, 90° = up (screen y-inverted)
  const rad = angleDeg * (Math.PI / 180);
  return {
    x: CENTER_X + distCm * SCALE * Math.cos(rad),
    y: CENTER_Y - distCm * SCALE * Math.sin(rad),
  };
}

/* ── Draw background grid ──────────────────────────────────────────────── */
function drawGrid(ctx, mode) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Background
  ctx.fillStyle = '#06090f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(148,163,184,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // Range rings (every 10cm)
  ctx.setLineDash([3, 4]);
  for (let r = 10; r <= MAX_RANGE; r += 10) {
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, r * SCALE, 0, Math.PI * 2);
    ctx.strokeStyle = r === 40
      ? 'rgba(239,68,68,0.25)'   // red ring at max range
      : 'rgba(99,102,241,0.15)';
    ctx.lineWidth = r === 40 ? 1.5 : 1;
    ctx.stroke();

    // Range label
    ctx.fillStyle = r === 40 ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.35)';
    ctx.font = '9px monospace';
    ctx.fillText(`${r}cm`, CENTER_X + r * SCALE + 3, CENTER_Y - 3);
  }
  ctx.setLineDash([]);

  // Angular rays every 30°
  ctx.setLineDash([2, 5]);
  for (let a = 0; a < 360; a += 30) {
    const end = toCanvas(MAX_RANGE + 2, a);
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = 'rgba(99,102,241,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Angle labels
    const lbl = toCanvas(MAX_RANGE + 5, a);
    ctx.fillStyle = 'rgba(148,163,184,0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${a}°`, lbl.x, lbl.y + 3);
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'start';

  // Center robot dot
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#6366f1';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, 10, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(99,102,241,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ── Draw points — 2D mode ─────────────────────────────────────────────── */
function drawPoints2D(ctx, points) {
  // Draw scan rays first (behind points)
  points.forEach(p => {
    const { x, y } = toCanvas(p.dist_cm, p.true_angle_deg);
    ctx.beginPath();
    ctx.moveTo(CENTER_X, CENTER_Y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = p.is_obstacle
      ? 'rgba(239,68,68,0.12)'
      : p.sensor === 'front'
        ? 'rgba(99,102,241,0.08)'
        : 'rgba(16,185,129,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw points on top
  points.forEach(p => {
    const { x, y } = toCanvas(p.dist_cm, p.true_angle_deg);
    const radius = p.is_obstacle ? 6 : 4;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (p.is_obstacle) {
      // Obstacle: bright red/orange
      ctx.fillStyle = 'rgba(239,68,68,0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(252,165,165,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (p.sensor === 'front') {
      // Front IR: indigo
      ctx.fillStyle = 'rgba(99,102,241,0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(165,180,252,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      // Rear IR: emerald
      ctx.fillStyle = 'rgba(16,185,129,0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,231,183,0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });

  // Draw US range ring where IR maxed out but US sees further (large delta)
  points.forEach(p => {
    if (p.ir_us_delta && p.ir_us_delta > 10 && p.ultrasonic_cm && p.ultrasonic_cm <= 400) {
      const { x, y } = toCanvas(Math.min(p.ultrasonic_cm, MAX_RANGE), p.true_angle_deg);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(59,130,246,0.5)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(147,197,253,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

/* ── Draw points — 2.5D mode (extruded pillars) ───────────────────────── */
function drawPoints25D(ctx, points) {
  // Sort by Y so farther points draw first (painter's algorithm)
  const sorted = [...points].sort((a, b) => {
    const ay = toCanvas(a.dist_cm, a.true_angle_deg).y;
    const by = toCanvas(b.dist_cm, b.true_angle_deg).y;
    return ay - by;
  });

  sorted.forEach(p => {
    const { x, y } = toCanvas(p.dist_cm, p.true_angle_deg);

    // Pillar height based on distance (closer = taller for perspective)
    const heightBase = 15 + (1 - p.dist_cm / MAX_RANGE) * 40;
    const height = p.is_obstacle ? heightBase * 1.5 : heightBase;

    // Isometric offset
    const topX = x - 3;
    const topY = y - height;

    // Pillar body
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(topX + 5, topY);
    ctx.lineTo(topX - 5, topY);
    ctx.closePath();

    if (p.is_obstacle) {
      ctx.fillStyle = 'rgba(239,68,68,0.75)';
    } else if (p.sensor === 'front') {
      ctx.fillStyle = 'rgba(99,102,241,0.5)';
    } else {
      ctx.fillStyle = 'rgba(16,185,129,0.4)';
    }
    ctx.fill();

    // Top cap
    ctx.beginPath();
    ctx.ellipse(topX, topY, 5, 2.5, 0, 0, Math.PI * 2);
    if (p.is_obstacle) {
      ctx.fillStyle = 'rgba(252,165,165,0.9)';
    } else if (p.sensor === 'front') {
      ctx.fillStyle = 'rgba(165,180,252,0.7)';
    } else {
      ctx.fillStyle = 'rgba(110,231,183,0.6)';
    }
    ctx.fill();

    // Side highlight
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(topX + 5, topY);
    ctx.strokeStyle = p.is_obstacle
      ? 'rgba(252,165,165,0.6)'
      : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/* ── Draw HUD overlay info ─────────────────────────────────────────────── */
function drawHUD(ctx, mode, pointCount, clusterCount) {
  ctx.fillStyle = 'rgba(99,102,241,0.6)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'start';
  ctx.fillText(`MODE: ${mode}`, 10, 18);
  ctx.fillText(`POINTS: ${pointCount}`, 10, 32);
  ctx.fillText(`CLUSTERS: ${clusterCount}`, 10, 46);
  ctx.fillText(`MAX RANGE: ${MAX_RANGE}cm`, 10, 60);

  // Legend
  const ly = CANVAS_H - 14;
  ctx.fillStyle = 'rgba(99,102,241,0.8)';
  ctx.fillRect(10, ly - 6, 8, 8);
  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.fillText('Front IR', 22, ly + 2);

  ctx.fillStyle = 'rgba(16,185,129,0.8)';
  ctx.fillRect(80, ly - 6, 8, 8);
  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.fillText('Rear IR', 92, ly + 2);

  ctx.fillStyle = 'rgba(239,68,68,0.8)';
  ctx.fillRect(150, ly - 6, 8, 8);
  ctx.fillStyle = 'rgba(148,163,184,0.6)';
  ctx.fillText('Obstacle (DBSCAN)', 162, ly + 2);

  if (mode === '2D') {
    ctx.fillStyle = 'rgba(59,130,246,0.8)';
    ctx.fillRect(300, ly - 6, 8, 8);
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.fillText('US extended range', 312, ly + 2);
  }
}

/* ── Main Component ────────────────────────────────────────────────────── */
export default function SpatialMap({ viewMode, session, polling }) {
  const canvasRef = useRef(null);
  const { scanData } = polling ?? {};
  const points = scanData?.points ?? [];
  const clusterCount = scanData?.clusters_found ?? 0;

  // Redraw canvas whenever data or mode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    drawGrid(ctx, viewMode);

    if (points.length > 0) {
      if (viewMode === '2D') {
        drawPoints2D(ctx, points);
      } else {
        drawPoints25D(ctx, points);
      }
    }

    drawHUD(ctx, viewMode, points.length, clusterCount);
  }, [viewMode, points, clusterCount]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            {viewMode === '2D' ? '2D Blueprint — 360° Radar' : '2.5D Spatial Reconstruction'}
            {session ? ` — ${session.name}` : ''}
          </h2>
          <p className={styles.sub}>
            {viewMode === '2D'
              ? 'Top-down view · range rings every 10cm · red ring = GP2Y0A41SK0F max (40cm)'
              : 'Isometric view · extruded pillars · taller = closer to robot'}
          </p>
        </div>
        <div className={styles.legend}>
          <span className={styles.dot} style={{ background: '#6366f1' }} /> Front IR
          <span className={styles.dot} style={{ background: '#10b981', marginLeft: 10 }} /> Rear IR
          <span className={styles.dot} style={{ background: '#ef4444', marginLeft: 10 }} /> Obstacle
        </div>
      </div>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className={styles.canvas} />
        {points.length === 0 && (
          <div className={styles.overlay}>
            {session ? 'Loading scan data...' : 'Select a session to view 360° map'}
          </div>
        )}
      </div>
    </div>
  );
}