const BASE = '/pathscan-api/v1';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

const mockSessions = [
  { basinId: 1, name: 'Lab Corridor A', region: 'Building 7, Floor 2' },
  { basinId: 2, name: 'Glass Hallway', region: 'Engineering Block B' },
  { basinId: 3, name: 'Warehouse Lane', region: 'Storage Zone C' },
];

const mockSensorsBySession = {
  1: [
    { stationId: 101, name: 'Front Short IR', latitude: 13.756, longitude: 100.501 },
    { stationId: 102, name: 'Rear Short IR', latitude: 13.756, longitude: 100.503 },
    { stationId: 103, name: 'Long Range IR', latitude: 13.757, longitude: 100.501 },
    { stationId: 104, name: 'Ultrasonic HC-SR04', latitude: 13.757, longitude: 100.504 },
  ],
  2: [
    { stationId: 201, name: 'Front Short IR', latitude: 13.758, longitude: 100.505 },
    { stationId: 202, name: 'Rear Short IR', latitude: 13.758, longitude: 100.507 },
    { stationId: 203, name: 'Long Range IR', latitude: 13.759, longitude: 100.506 },
    { stationId: 204, name: 'Ultrasonic HC-SR04', latitude: 13.759, longitude: 100.508 },
  ],
  3: [
    { stationId: 301, name: 'Front Short IR', latitude: 13.760, longitude: 100.510 },
    { stationId: 302, name: 'Rear Short IR', latitude: 13.760, longitude: 100.512 },
    { stationId: 303, name: 'Long Range IR', latitude: 13.761, longitude: 100.511 },
    { stationId: 304, name: 'Ultrasonic HC-SR04', latitude: 13.761, longitude: 100.513 },
  ],
};

const mockTransparencySeriesBySession = {
  1: [
    { year: 0, rainfall: 0.15 },
    { year: 15, rainfall: 0.31 },
    { year: 30, rainfall: 0.22 },
    { year: 45, rainfall: 0.74 },
    { year: 60, rainfall: 0.8 },
    { year: 75, rainfall: 0.42 },
  ],
  2: [
    { year: 0, rainfall: 0.11 },
    { year: 15, rainfall: 0.18 },
    { year: 30, rainfall: 0.54 },
    { year: 45, rainfall: 0.89 },
    { year: 60, rainfall: 0.76 },
    { year: 75, rainfall: 0.6 },
  ],
  3: [
    { year: 0, rainfall: 0.05 },
    { year: 15, rainfall: 0.09 },
    { year: 30, rainfall: 0.13 },
    { year: 45, rainfall: 0.2 },
    { year: 60, rainfall: 0.28 },
    { year: 75, rainfall: 0.35 },
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
  USE_MOCK ? withFallback(() => get('/sessions'), mockSessions) : get('/sessions');

export const fetchBasin = (id) =>
  USE_MOCK ? withFallback(() => get(`/sessions/${id}`), mockSessions.find((s) => s.basinId === id)) : get(`/sessions/${id}`);

export const fetchStations = (sessionId) =>
  USE_MOCK
    ? withFallback(() => get(`/sessions/${sessionId}/sensors`), mockSensorsBySession[sessionId] ?? [])
    : get(`/sessions/${sessionId}/sensors`);

export const fetchAllRainfalls = (sessionId) =>
  USE_MOCK
    ? withFallback(() => get(`/sessions/${sessionId}/transparency-index`), mockTransparencySeriesBySession[sessionId] ?? [])
    : get(`/sessions/${sessionId}/transparency-index`);

export const fetchRainfallByYear = (sessionId, segmentAngle) =>
  USE_MOCK
    ? withFallback(
        () => get(`/sessions/${sessionId}/transparency-index/${segmentAngle}`),
        (mockTransparencySeriesBySession[sessionId] ?? []).find((r) => r.year === segmentAngle) ?? null
      )
    : get(`/sessions/${sessionId}/transparency-index/${segmentAngle}`);
