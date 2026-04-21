import { useState } from 'react';
import Sidebar            from './components/Sidebar';
import TransparencyChart  from './components/TransparencyChart';
import StationList        from './components/StationList';
import SensorChart        from './components/SensorChart';
import SpatialMap         from './components/SpatialMap';
import StatsRow           from './components/StatsRow';
import { usePolling }     from './hooks/usePolling';
import styles             from './App.module.css';

export default function App() {
  const [selectedBasin, setSelectedBasin] = useState(null);
  const [viewMode,      setViewMode]      = useState('2D');
  const [tiData,        setTiData]        = useState([]);

  const sessionId = selectedBasin?.basinId ?? null;
  const polling = usePolling(sessionId);

  return (
    <div className={styles.shell}>
      <Sidebar selected={selectedBasin} onSelect={setSelectedBasin} />

      <div className={styles.body}>
        <main className={styles.main}>

          {/* ── Top bar ── */}
          <header className={styles.topbar}>
            <div>
              <h1 className={styles.title}>PathScan Mission Console</h1>
              <p className={styles.subtitle}>
                Hybrid IR + Ultrasonic · Transparency Index · Glass Detection · 2D/2.5D Spatial Mapping
              </p>
            </div>
            <div className={styles.controls}>
              <span className={styles.badge}>Transparency Index</span>
              <span className={styles.badge}>Material Fusion</span>
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

          {/* ── Live stats row (shared polling every 3s) ── */}
          <StatsRow sessionId={sessionId} transparencyData={tiData} polling={polling} />

          {/* ── Spatial map canvas ── */}
          <SpatialMap viewMode={viewMode} basin={selectedBasin} sessionId={sessionId} polling={polling} />

          {/* ── IR vs Ultrasonic line chart ── */}
          <SensorChart sessionId={sessionId} polling={polling} />

          {/* ── Transparency index bar chart (from DB via API) ── */}
          <TransparencyChart
            basin={selectedBasin}
            viewMode={viewMode}
            onDataLoaded={setTiData}
          />

          {/* ── Sensor array info cards ── */}
          <StationList basin={selectedBasin} />

        </main>
      </div>
    </div>
  );
}