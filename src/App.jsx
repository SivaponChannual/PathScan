import { useState } from 'react';
import Sidebar         from './components/Sidebar';
import SpatialMap      from './components/SpatialMap';
import StatsRow        from './components/StatsRow';
import SensorChart     from './components/SensorChart';
import DistanceChart   from './components/DistanceChart';
import StationList     from './components/StationList';
import { usePolling }  from './hooks/usePolling';
import styles          from './App.module.css';

export default function App() {
  const [selectedSession, setSelectedSession] = useState(null);
  const [viewMode,        setViewMode]        = useState('2D');

  const sessionName = selectedSession?.name ?? null;
  const polling     = usePolling(sessionName);

  return (
    <div className={styles.shell}>
      <Sidebar selected={selectedSession} onSelect={setSelectedSession} />

      <div className={styles.body}>
        <main className={styles.main}>

          {/* ── Top bar ── */}
          <header className={styles.topbar}>
            <div>
              <h1 className={styles.title}>PathScan Radar Console</h1>
              <p className={styles.subtitle}>
                Dual IR (GP2Y0A41SK0F) + Ultrasonic (HC-SR04) · SG90 Servo Sweep · 360° Spatial Mapping
              </p>
            </div>
            <div className={styles.controls}>
              <span className={styles.badge}>DBSCAN Clustering</span>
              <span className={styles.badge}>360° Sweep</span>
              <div className={styles.toggle}>
                <button
                  className={`${styles.toggleBtn} ${viewMode === '2D' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('2D')}
                >
                  2D Blueprint
                </button>
                <button
                  className={`${styles.toggleBtn} ${viewMode === '2.5D' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('2.5D')}
                >
                  2.5D Reconstruction
                </button>
              </div>
            </div>
          </header>

          {/* ── Live stats ── */}
          <StatsRow sessionName={sessionName} polling={polling} />

          {/* ── Spatial map canvas (2D / 2.5D toggle) ── */}
          <SpatialMap
            viewMode={viewMode}
            session={selectedSession}
            polling={polling}
          />

          {/* ── Front vs Rear vs Ultrasonic line chart ── */}
          <SensorChart sessionName={sessionName} />

          {/* ── Distance by angle bar chart ── */}
          <DistanceChart sessionName={sessionName} />

          {/* ── Sensor array info cards ── */}
          <StationList sessionName={sessionName} />

        </main>
      </div>
    </div>
  );
}