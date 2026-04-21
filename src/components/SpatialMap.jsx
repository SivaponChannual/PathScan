import { useEffect, useRef } from 'react';
import styles from './SpatialMap.module.css';

const CANVAS_W = 600;
const CANVAS_H = 340;
const ORIGIN_X = CANVAS_W / 2;
const ORIGIN_Y = CANVAS_H - 40;
const SCALE    = 1.8;
const MAX_RANGE_CM = 150;
const STEP_ANGLE_DEG = 15;
const HISTORY_LIMIT = 60;
const PREFILL_RETRY_MS = 8000;

function toCanvas2D(distCm, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: ORIGIN_X + distCm * SCALE * Math.cos(rad),
    y: ORIGIN_Y - distCm * SCALE * Math.sin(rad) * 0.7,
  };
}

function toCanvas25D(distCm, angleDeg, height = 30) {
  const base = toCanvas2D(distCm, angleDeg);
  return { bx: base.x, by: base.y, tx: base.x - 4, ty: base.y - height };
}

function drawGrid(ctx, mode) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#06090f';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.strokeStyle = 'rgba(148,163,184,0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }

  // Horizontal centerline and forward direction line
  ctx.strokeStyle = 'rgba(99,102,241,0.22)';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(0, ORIGIN_Y);
  ctx.lineTo(CANVAS_W, ORIGIN_Y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ORIGIN_X, ORIGIN_Y);
  ctx.lineTo(ORIGIN_X, ORIGIN_Y - MAX_RANGE_CM * SCALE * 0.7);
  ctx.stroke();
  ctx.setLineDash([]);

  // Robot origin
  ctx.beginPath();
  ctx.arc(ORIGIN_X, ORIGIN_Y, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#6366f1';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99,102,241,0.4)';
  ctx.lineWidth = 8;
  ctx.stroke();

  if (mode === '2D') {
    [30, 60, 90, 120, 150].forEach(r => {
      ctx.beginPath();
      ctx.arc(ORIGIN_X, ORIGIN_Y, r * SCALE * 0.7, Math.PI, 2 * Math.PI);
      ctx.strokeStyle = r % 60 === 0 ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(99,102,241,0.4)';
      ctx.font = '9px monospace';
      ctx.fillText(`${r}cm`, ORIGIN_X + r * SCALE * 0.7 + 2, ORIGIN_Y - 2);
    });

    // Angular rays to make point direction easier to read
    for (let angle = 15; angle <= 165; angle += 30) {
      const end = toCanvas2D(MAX_RANGE_CM, angle);
      ctx.beginPath();
      ctx.moveTo(ORIGIN_X, ORIGIN_Y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = 'rgba(59,130,246,0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function drawPoints(ctx, points, mode) {
  points.forEach(({ distCm, angleDeg, isGlass, transparencyIndex }, idx) => {
    const ageFactor = 1 - idx / Math.max(points.length, 1);
    if (mode === '2D') {
      const { x, y } = toCanvas2D(distCm, angleDeg);

      // Draw a subtle ray from robot to each point so scan direction is readable.
      ctx.beginPath();
      ctx.moveTo(ORIGIN_X, ORIGIN_Y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isGlass
        ? `rgba(59,130,246,${0.08 + ageFactor * 0.12})`
        : `rgba(148,163,184,${0.06 + ageFactor * 0.08})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 4 + ageFactor * 3, 0, Math.PI * 2);
      ctx.fillStyle = isGlass
        ? `rgba(59,130,246,${0.35 + transparencyIndex * 0.45 + ageFactor * 0.15})`
        : `rgba(160,174,192,${0.2 + ageFactor * 0.6})`;
      ctx.fill();

      ctx.strokeStyle = isGlass
        ? `rgba(125,211,252,${0.4 + ageFactor * 0.5})`
        : `rgba(226,232,240,${0.2 + ageFactor * 0.35})`;
      ctx.lineWidth = isGlass ? 1.6 : 1.1;
      ctx.stroke();
    } else {
      const height = 20 + transparencyIndex * 60;
      const { bx, by, tx, ty } = toCanvas25D(distCm, angleDeg, height);
      const alpha = isGlass ? transparencyIndex * 0.5 : 0.85;

      ctx.beginPath();
      ctx.moveTo(bx - 5, by); ctx.lineTo(bx + 5, by);
      ctx.lineTo(tx + 5, ty); ctx.lineTo(tx - 5, ty);
      ctx.closePath();
      ctx.fillStyle = isGlass
        ? `rgba(59,130,246,${alpha})`
        : `rgba(100,116,139,${alpha})`;
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(tx, ty, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = isGlass
        ? `rgba(147,197,253,${alpha})`
        : `rgba(148,163,184,${alpha})`;
      ctx.fill();
    }
  });
}

export default function SpatialMap({ viewMode, basin, sessionId, polling }) {
  const canvasRef    = useRef(null);
  const pointsRef    = useRef([]);
  const angleRef     = useRef(0);
  const lastTsRef    = useRef(null);
  const { readings = [] } = polling ?? {};

  // Clear map when session changes
  useEffect(() => {
    pointsRef.current = [];
    angleRef.current  = 0;
    lastTsRef.current = null;
  }, [sessionId]);

  // Prefill map with recent history so radar does not start empty.
  useEffect(() => {
    if (!sessionId) return;
    let isCancelled = false;
    let retryTimer = null;

    const loadRecent = async () => {
      try {
        const res = await fetch(`/pathscan-api/v1/sessions/${sessionId}/readings?limit=${HISTORY_LIMIT}`);
        if (!res.ok) throw new Error('history request failed');
        const rows = await res.json();
        if (isCancelled || !Array.isArray(rows) || rows.length === 0) throw new Error('no history rows');

        const prefilled = rows.map((row, idx) => ({
          distCm: row.primaryDistCm,
          angleDeg: ((idx + 1) * STEP_ANGLE_DEG) % 180,
          isGlass: row.isGlass ?? false,
          transparencyIndex: row.transparencyIndex ?? 0,
        }));

        pointsRef.current = prefilled.slice(-HISTORY_LIMIT).reverse();
        angleRef.current = (prefilled.length * STEP_ANGLE_DEG) % 180;
        lastTsRef.current = rows.at(-1)?.timestamp ?? null;
      } catch {
        // Retry history load to recover from transient backend/DB limits.
        if (!isCancelled && pointsRef.current.length <= 1) {
          retryTimer = setTimeout(loadRecent, PREFILL_RETRY_MS);
        }
      }
    };

    loadRecent();
    return () => {
      isCancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [sessionId]);

  // Add point only when timestamp is new
  useEffect(() => {
    const r = readings[0];
    if (!r?.data?.primaryDistCm) return;

    const ts = r.data.timestamp;
    if (ts && ts === lastTsRef.current) return; // skip duplicate
    lastTsRef.current = ts;

    angleRef.current = (angleRef.current + STEP_ANGLE_DEG) % 180;
    const point = {
      distCm:            r.data.primaryDistCm,
      angleDeg:          angleRef.current,
      isGlass:           r.data.isGlass ?? false,
      transparencyIndex: r.data.transparencyIndex ?? 0,
    };
    pointsRef.current = [point, ...pointsRef.current].slice(0, HISTORY_LIMIT);
  }, [readings]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawGrid(ctx, viewMode);
    drawPoints(ctx, pointsRef.current, viewMode);

    ctx.fillStyle = 'rgba(99,102,241,0.6)';
    ctx.font = '10px monospace';
    ctx.fillText(`MODE: ${viewMode}`, 10, 18);
    ctx.fillText(`POINTS: ${pointsRef.current.length}`, 10, 32);

    if (viewMode === '2.5D') {
      ctx.fillStyle = 'rgba(59,130,246,0.7)';
      ctx.fillText('■ Glass (semi-transparent)', CANVAS_W - 165, 18);
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
      ctx.fillText('■ Solid Wall', CANVAS_W - 165, 32);
    }
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            {viewMode === '2D' ? '2D Blueprint' : '2.5D Spatial Reconstruction'}
            {basin ? ` — ${basin.name}` : ''}
          </h2>
          <p className={styles.sub}>
            {viewMode === '2D'
              ? 'Top-down view · rings + scan rays for clearer obstacle position'
              : 'Isometric view · extruded pillars · blue = glass, grey = solid'}
          </p>
        </div>
        <div className={styles.legend}>
          <span className={styles.dot} style={{ background: '#6366f1' }} /> Robot
          <span className={styles.dot} style={{ background: '#94a3b8', marginLeft: 10 }} /> Solid
          <span className={styles.dot} style={{ background: '#3b82f6', marginLeft: 10 }} /> Glass
        </div>
      </div>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className={styles.canvas} />
        {pointsRef.current.length === 0 && (
          <div className={styles.overlay}>
            {sessionId ? 'No scan data for this session yet' : 'Select a session to view map'}
          </div>
        )}
      </div>
    </div>
  );
}