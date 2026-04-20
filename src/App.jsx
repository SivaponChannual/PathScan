import { useState } from 'react';
import Sidebar       from './components/Sidebar';
import RainfallChart from './components/RainfallChart';
import StationList   from './components/StationList';
import NodeRedPanel  from './components/NodeRedPanel';
import styles        from './App.module.css';

export default function App() {
  const [selectedBasin, setSelectedBasin] = useState(null);
  const [viewMode, setViewMode] = useState('2D');

  return (
    <div className={styles.shell}>
      <Sidebar selected={selectedBasin} onSelect={setSelectedBasin} />

      <div className={styles.body}>
        <main className={styles.main}>
          <header className={styles.topbar}>
            <div>
              <h1 className={styles.title}>PathScan Mission Console</h1>
              <p className={styles.subtitle}>Hybrid IR + Ultrasonic spatial mapping with glass detection</p>
            </div>

            <div className={styles.controls}>
              <span className={styles.badge}>Transparency Index</span>
              <span className={styles.badge}>Material Fusion Logic</span>
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

          <RainfallChart basin={selectedBasin} viewMode={viewMode} />
          <StationList   basin={selectedBasin} />
        </main>

        <NodeRedPanel />
      </div>
    </div>
  );
}
