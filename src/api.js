const BASE = '/pathscan-api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

const mockSessions = [
  { basinId: 1, name: 'Lab Corridor A',  region: 'Building 7, Floor 2'   },
  { basinId: 2, name: 'Glass Hallway',   region: 'Engineering Block B'   },
  { basinId: 3, name: 'Warehouse Lane',  region: 'Storage Zone C'        },
];

const mockSensorsBySession = {
  1: [
    { stationId: 101, name: 'Front Short IR (GP2Y0A41)',  type: 'IR_SHORT',   rangeNote: '4–30 cm'   },
    { stationId: 102, name: 'Rear Short IR (GP2Y0A41)',   type: 'IR_SHORT',   rangeNote: '4–30 cm'   },
    { stationId: 103, name: 'Long Range IR (GP2Y0A02)',   type: 'IR_LONG',    rangeNote: '20–150 cm' },
    { stationId: 104, name: 'Ultrasonic HC-SR04',         type: 'ULTRASONIC', rangeNote: '2–400 cm'  },
  ],
  2: [
    { stationId: 201, name: 'Front Short IR (GP2Y0A41)',  type: 'IR_SHORT',   rangeNote: '4–30 cm'   },
    { stationId: 202, name: 'Rear Short IR (GP2Y0A41)',   type: 'IR_SHORT',   rangeNote: '4–30 cm'   },
    { stationId: 203, name: 'Long Range IR (GP2Y0A02)',   type: 'IR_LONG',    rangeNote: '20–150 cm' },
    { stationId: 204, name: 'Ultrasonic HC-SR04',         type: 'ULTRASONIC', rangeNote: '2–400 cm'  },
  ],
  3: [
    { stationId: 301, name: 'Front Short IR (GP2Y0A41)',  type: 'IR_SHORT',   rangeNote: '4–30 cm'   },
    { stationId: 302, name: 'Rear Short IR (GP2Y0A41)',   type: 'IR_SHORT',   rangeNote: '4–30 cm'   },
    { stationId: 303, name: 'Long Range IR (GP2Y0A02)',   type: 'IR_LONG',    rangeNote: '20–150 cm' },
    { stationId: 304, name: 'Ultrasonic HC-SR04',         type: 'ULTRASONIC', rangeNote: '2–400 cm'  },
  ],
};

// Renamed: year → angle, rainfall → transparencyIndex
const mockTransparencyBySession = {
  1: [
    { angle: 0,   transparencyIndex: 0.15, materialType: 'PLYWOOD' },
    { angle: 15,  transparencyIndex: 0.31, materialType: 'METAL'   },
    { angle: 30,  transparencyIndex: 0.22, materialType: 'PLYWOOD' },
    { angle: 45,  transparencyIndex: 0.74, materialType: 'GLASS'   },
    { angle: 60,  transparencyIndex: 0.80, materialType: 'GLASS'   },
    { angle: 75,  transparencyIndex: 0.42, materialType: 'ACRYLIC' },
  ],
  2: [
    { angle: 0,   transparencyIndex: 0.11, materialType: 'PLYWOOD' },
    { angle: 15,  transparencyIndex: 0.18, materialType: 'PLYWOOD' },
    { angle: 30,  transparencyIndex: 0.54, materialType: 'ACRYLIC' },
    { angle: 45,  transparencyIndex: 0.89, materialType: 'GLASS'   },
    { angle: 60,  transparencyIndex: 0.76, materialType: 'GLASS'   },
    { angle: 75,  transparencyIndex: 0.60, materialType: 'GLASS'   },
  ],
  3: [
    { angle: 0,   transparencyIndex: 0.05, materialType: 'PLYWOOD' },
    { angle: 15,  transparencyIndex: 0.09, materialType: 'PLYWOOD' },
    { angle: 30,  transparencyIndex: 0.13, materialType: 'PLYWOOD' },
    { angle: 45,  transparencyIndex: 0.20, materialType: 'METAL'   },
    { angle: 60,  transparencyIndex: 0.28, materialType: 'METAL'   },
    { angle: 75,  transparencyIndex: 0.35, materialType: 'METAL'   },
  ],
};

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function withFallback(requestFn, fallbackData) {
  return requestFn().catch(() => fallbackData);
}

export const fetchBasins = () =>
  USE_MOCK
    ? withFallback(() => get('/sessions'), mockSessions)
    : get('/sessions');

export const fetchBasin = (id) =>
  USE_MOCK
    ? withFallback(() => get(`/sessions/${id}`), mockSessions.find(s => s.basinId === id))
    : get(`/sessions/${id}`);

export const fetchStations = (sessionId) =>
  USE_MOCK
    ? withFallback(() => get(`/sessions/${sessionId}/sensors`), mockSensorsBySession[sessionId] ?? [])
    : get(`/sessions/${sessionId}/sensors`);

// Returns array of { angle, transparencyIndex, materialType }
export const fetchAllRainfalls = (sessionId) =>
  USE_MOCK
    ? withFallback(
        () => get(`/sessions/${sessionId}/transparency-index`),
        mockTransparencyBySession[sessionId] ?? []
      )
    : get(`/sessions/${sessionId}/transparency-index`);

export const fetchRainfallByYear = (sessionId, segmentAngle) =>
  USE_MOCK
    ? withFallback(
        () => get(`/sessions/${sessionId}/transparency-index/${segmentAngle}`),
        (mockTransparencyBySession[sessionId] ?? []).find(r => r.angle === segmentAngle) ?? null
      )
    : get(`/sessions/${sessionId}/transparency-index/${segmentAngle}`);