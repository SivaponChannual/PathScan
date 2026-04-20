import { useState } from 'react';
import Sidebar       from './components/Sidebar';
import RainfallChart from './components/RainfallChart';
import StationList   from './components/StationList';
import NodeRedPanel  from './components/NodeRedPanel';
import styles        from './App.module.css';

export default function App() {
  const [selectedBasin, setSelectedBasin] = useState(null);

  return (
    <div className={styles.shell}>
      <Sidebar selected={selectedBasin} onSelect={setSelectedBasin} />

      <div className={styles.body}>
        <main className={styles.main}>
          <RainfallChart basin={selectedBasin} />
          <StationList   basin={selectedBasin} />
        </main>

        <NodeRedPanel />
      </div>
    </div>
  );
}
