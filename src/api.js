/**
 * PathScan v2.0 API layer
 * Single table: scan_telemetry
 * Sensors: 2× GP2Y0A41SK0F (4-40 cm) + HC-SR04 (2-400 cm) on SG90 servo
 */

const BASE = '/pathscan-api/v1';

// Hardware limits 
const IR_MIN = 4, IR_MAX = 40, US_MAX = 400;

function clampIR(v) { return Math.max(IR_MIN, Math.min(IR_MAX, v)); }
function clampUS(v) { return Math.max(2, Math.min(US_MAX, v)); }

function polar2cart(dist, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return { x: +(dist * Math.cos(rad)).toFixed(2), y: +(dist * Math.sin(rad)).toFixed(2) };
}

// Mock: Lab Room A 
// Asymmetric room: robot near left wall. Right wall far. Desk leg at 30-40°.
// Trash bin at rear 280-290° (servo 100-110°).
function generateLabRoom() {
  const rawData = [
    [0, 28.4, 10.2, 28.9], [5, 27.8, 10.5, 28.3], [10, 26.1, 11.0, 26.7],
    [15, 24.3, 11.8, 24.9], [20, 22.0, 12.9, 22.5], [25, 19.5, 14.2, 20.0],
    [30, 8.3, 15.8, 8.6], [35, 7.1, 17.5, 7.4], [40, 8.5, 19.3, 8.8],
    [45, 21.2, 21.0, 21.6], [50, 19.5, 22.8, 19.9], [55, 18.1, 24.6, 18.5],
    [60, 17.2, 26.5, 17.6], [65, 16.5, 28.1, 16.9], [70, 15.9, 29.4, 16.3],
    [75, 15.5, 30.2, 15.9], [80, 15.2, 30.8, 15.6], [85, 15.0, 31.0, 15.4],
    [90, 14.9, 31.1, 15.3], [95, 15.0, 30.9, 15.4], [100, 15.3, 11.0, 15.7],
    [105, 15.8, 10.5, 16.2], [110, 16.5, 11.2, 16.9], [115, 17.4, 24.8, 17.8],
    [120, 18.8, 22.0, 19.3], [125, 20.5, 19.5, 21.0], [130, 22.5, 17.2, 23.0],
    [135, 21.3, 15.4, 21.8], [140, 19.8, 13.8, 20.3], [145, 17.6, 12.5, 18.1],
    [150, 15.2, 11.5, 15.7], [155, 13.5, 10.8, 14.0], [160, 12.0, 10.3, 12.5],
    [165, 11.0, 10.0, 11.5], [170, 10.3, 9.8, 10.8], [175, 10.0, 9.7, 10.5],
    [180, 9.8, 10.0, 10.3],
  ];
  return expandToPoints(rawData);
}

// Mock: Corridor B 
// Narrow corridor. Close side walls (~12cm). Open end at 65-110° where
// IR maxes at 40cm but ultrasonic sees 80-135cm down the hallway.
function generateCorridor() {
  const rawData = [
    [0, 12.3, 12.1, 12.7], [5, 12.4, 12.2, 12.9], [10, 12.6, 12.4, 13.1],
    [15, 13.0, 12.8, 13.5], [20, 13.6, 13.3, 14.1], [25, 14.5, 14.1, 15.0],
    [30, 15.7, 15.3, 16.2], [35, 17.3, 16.8, 17.8], [40, 19.5, 18.9, 20.1],
    [45, 22.6, 21.8, 23.2], [50, 27.0, 25.8, 27.6], [55, 33.2, 31.5, 33.9],
    [60, 38.5, 36.8, 52.3], [65, 40.0, 40.0, 78.5], [70, 40.0, 40.0, 95.2],
    [75, 40.0, 40.0, 112.8], [80, 40.0, 40.0, 125.3], [85, 40.0, 40.0, 132.1],
    [90, 40.0, 40.0, 135.6], [95, 40.0, 40.0, 130.4], [100, 40.0, 40.0, 120.7],
    [105, 40.0, 40.0, 105.3], [110, 40.0, 40.0, 88.1], [115, 38.8, 37.0, 70.5],
    [120, 34.5, 32.8, 35.2], [125, 28.2, 27.0, 28.9], [130, 23.5, 22.5, 24.1],
    [135, 20.1, 19.3, 20.7], [140, 17.8, 17.1, 18.3], [145, 16.0, 15.5, 16.5],
    [150, 14.8, 14.4, 15.3], [155, 13.8, 13.5, 14.3], [160, 13.1, 12.8, 13.6],
    [165, 12.7, 12.5, 13.2], [170, 12.5, 12.3, 13.0], [175, 12.4, 12.2, 12.9],
    [180, 12.3, 12.1, 12.8],
  ];
  return expandToPoints(rawData);
}

// Convert raw [angle, front, rear, us] → 360° point cloud 
function expandToPoints(rawData) {
  const points = [];
  for (const [servo, front, rear, us] of rawData) {
    const frontAngle = servo;
    const rearAngle = (servo + 180) % 360;

    // Add noise ±0.2cm to simulate ADC jitter
    const fDist = clampIR(front + (Math.random() - 0.5) * 0.4);
    const rDist = clampIR(rear + (Math.random() - 0.5) * 0.4);
    const uDist = clampUS(us + (Math.random() - 0.5) * 0.6);

    const fc = polar2cart(fDist, frontAngle);
    const delta = Math.abs(uDist - fDist);
    points.push({
      sensor: 'front', servo_angle_deg: servo,
      true_angle_deg: frontAngle, dist_cm: +fDist.toFixed(1),
      ultrasonic_cm: +uDist.toFixed(1), ir_us_delta: +delta.toFixed(1),
      x: fc.x, y: fc.y, cluster: -1, is_obstacle: false,
    });

    const rc = polar2cart(rDist, rearAngle);
    points.push({
      sensor: 'rear', servo_angle_deg: servo,
      true_angle_deg: rearAngle, dist_cm: +rDist.toFixed(1),
      ultrasonic_cm: null, ir_us_delta: null,
      x: rc.x, y: rc.y, cluster: -1, is_obstacle: false,
    });
  }

  // Simple DBSCAN-like obstacle marking
  // Obstacle = front point much closer than its neighbors (spike)
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (p.sensor !== 'front') continue;
    // Find neighbor front points
    const prevFront = points.slice(0, i).reverse().find(q => q.sensor === 'front');
    const nextFront = points.slice(i + 1).find(q => q.sensor === 'front');
    if (!prevFront || !nextFront) continue;
    const avgNeighbor = (prevFront.dist_cm + nextFront.dist_cm) / 2;
    // If this point is >40% closer than neighbors, it's an obstacle
    if (p.dist_cm < avgNeighbor * 0.6) {
      p.cluster = 0;
      p.is_obstacle = true;
    }
  }
  // Also check rear spikes
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (p.sensor !== 'rear') continue;
    const prevRear = points.slice(0, i).reverse().find(q => q.sensor === 'rear');
    const nextRear = points.slice(i + 1).find(q => q.sensor === 'rear');
    if (!prevRear || !nextRear) continue;
    const avgNeighbor = (prevRear.dist_cm + nextRear.dist_cm) / 2;
    if (p.dist_cm < avgNeighbor * 0.6) {
      p.cluster = 1;
      p.is_obstacle = true;
    }
  }

  return points;
}

// Mock session list 
const labPoints = generateLabRoom();
const corridorPoints = generateCorridor();

const labObstacles = labPoints.filter(p => p.is_obstacle).length;
const labClusters = new Set(labPoints.filter(p => p.cluster >= 0).map(p => p.cluster)).size;
const corObstacles = corridorPoints.filter(p => p.is_obstacle).length;
const corClusters = new Set(corridorPoints.filter(p => p.cluster >= 0).map(p => p.cluster)).size;

const mockSessions = [
  { sessionId: 1, name: 'Lab Room A', pointCount: labPoints.length, startedAt: '2026-04-21 10:00:00' },
  { sessionId: 2, name: 'Corridor B', pointCount: corridorPoints.length, startedAt: '2026-04-21 11:00:00' },
];

const mockScanData = {
  'Lab Room A': {
    session_name: 'Lab Room A', raw_readings: 37,
    total_points: labPoints.length, clusters_found: labClusters,
    sensor_spec: { ir_model: 'GP2Y0A41SK0F', ir_min_cm: 4, ir_max_cm: 40, us_model: 'HC-SR04', us_min_cm: 2, us_max_cm: 400 },
    points: labPoints,
  },
  'Corridor B': {
    session_name: 'Corridor B', raw_readings: 37,
    total_points: corridorPoints.length, clusters_found: corClusters,
    sensor_spec: { ir_model: 'GP2Y0A41SK0F', ir_min_cm: 4, ir_max_cm: 40, us_model: 'HC-SR04', us_min_cm: 2, us_max_cm: 400 },
    points: corridorPoints,
  },
};

const mockReadings = {
  'Lab Room A': [
    { servo_angle_deg: 0, front_dist_cm: 28.4, rear_dist_cm: 10.2, ultrasonic_cm: 28.9 },
    { servo_angle_deg: 5, front_dist_cm: 27.8, rear_dist_cm: 10.5, ultrasonic_cm: 28.3 },
    { servo_angle_deg: 10, front_dist_cm: 26.1, rear_dist_cm: 11.0, ultrasonic_cm: 26.7 },
    { servo_angle_deg: 15, front_dist_cm: 24.3, rear_dist_cm: 11.8, ultrasonic_cm: 24.9 },
    { servo_angle_deg: 20, front_dist_cm: 22.0, rear_dist_cm: 12.9, ultrasonic_cm: 22.5 },
    { servo_angle_deg: 25, front_dist_cm: 19.5, rear_dist_cm: 14.2, ultrasonic_cm: 20.0 },
    { servo_angle_deg: 30, front_dist_cm: 8.3, rear_dist_cm: 15.8, ultrasonic_cm: 8.6 },
    { servo_angle_deg: 35, front_dist_cm: 7.1, rear_dist_cm: 17.5, ultrasonic_cm: 7.4 },
    { servo_angle_deg: 40, front_dist_cm: 8.5, rear_dist_cm: 19.3, ultrasonic_cm: 8.8 },
    { servo_angle_deg: 45, front_dist_cm: 21.2, rear_dist_cm: 21.0, ultrasonic_cm: 21.6 },
    { servo_angle_deg: 50, front_dist_cm: 19.5, rear_dist_cm: 22.8, ultrasonic_cm: 19.9 },
    { servo_angle_deg: 55, front_dist_cm: 18.1, rear_dist_cm: 24.6, ultrasonic_cm: 18.5 },
    { servo_angle_deg: 60, front_dist_cm: 17.2, rear_dist_cm: 26.5, ultrasonic_cm: 17.6 },
    { servo_angle_deg: 65, front_dist_cm: 16.5, rear_dist_cm: 28.1, ultrasonic_cm: 16.9 },
    { servo_angle_deg: 70, front_dist_cm: 15.9, rear_dist_cm: 29.4, ultrasonic_cm: 16.3 },
    { servo_angle_deg: 75, front_dist_cm: 15.5, rear_dist_cm: 30.2, ultrasonic_cm: 15.9 },
    { servo_angle_deg: 80, front_dist_cm: 15.2, rear_dist_cm: 30.8, ultrasonic_cm: 15.6 },
    { servo_angle_deg: 85, front_dist_cm: 15.0, rear_dist_cm: 31.0, ultrasonic_cm: 15.4 },
    { servo_angle_deg: 90, front_dist_cm: 14.9, rear_dist_cm: 31.1, ultrasonic_cm: 15.3 },
    { servo_angle_deg: 95, front_dist_cm: 15.0, rear_dist_cm: 30.9, ultrasonic_cm: 15.4 },
    { servo_angle_deg: 100, front_dist_cm: 15.3, rear_dist_cm: 11.0, ultrasonic_cm: 15.7 },
    { servo_angle_deg: 105, front_dist_cm: 15.8, rear_dist_cm: 10.5, ultrasonic_cm: 16.2 },
    { servo_angle_deg: 110, front_dist_cm: 16.5, rear_dist_cm: 11.2, ultrasonic_cm: 16.9 },
    { servo_angle_deg: 115, front_dist_cm: 17.4, rear_dist_cm: 24.8, ultrasonic_cm: 17.8 },
    { servo_angle_deg: 120, front_dist_cm: 18.8, rear_dist_cm: 22.0, ultrasonic_cm: 19.3 },
    { servo_angle_deg: 125, front_dist_cm: 20.5, rear_dist_cm: 19.5, ultrasonic_cm: 21.0 },
    { servo_angle_deg: 130, front_dist_cm: 22.5, rear_dist_cm: 17.2, ultrasonic_cm: 23.0 },
    { servo_angle_deg: 135, front_dist_cm: 21.3, rear_dist_cm: 15.4, ultrasonic_cm: 21.8 },
    { servo_angle_deg: 140, front_dist_cm: 19.8, rear_dist_cm: 13.8, ultrasonic_cm: 20.3 },
    { servo_angle_deg: 145, front_dist_cm: 17.6, rear_dist_cm: 12.5, ultrasonic_cm: 18.1 },
    { servo_angle_deg: 150, front_dist_cm: 15.2, rear_dist_cm: 11.5, ultrasonic_cm: 15.7 },
    { servo_angle_deg: 155, front_dist_cm: 13.5, rear_dist_cm: 10.8, ultrasonic_cm: 14.0 },
    { servo_angle_deg: 160, front_dist_cm: 12.0, rear_dist_cm: 10.3, ultrasonic_cm: 12.5 },
    { servo_angle_deg: 165, front_dist_cm: 11.0, rear_dist_cm: 10.0, ultrasonic_cm: 11.5 },
    { servo_angle_deg: 170, front_dist_cm: 10.3, rear_dist_cm: 9.8, ultrasonic_cm: 10.8 },
    { servo_angle_deg: 175, front_dist_cm: 10.0, rear_dist_cm: 9.7, ultrasonic_cm: 10.5 },
    { servo_angle_deg: 180, front_dist_cm: 9.8, rear_dist_cm: 10.0, ultrasonic_cm: 10.3 },
  ],
  'Corridor B': [
    { servo_angle_deg: 0, front_dist_cm: 12.3, rear_dist_cm: 12.1, ultrasonic_cm: 12.7 },
    { servo_angle_deg: 5, front_dist_cm: 12.4, rear_dist_cm: 12.2, ultrasonic_cm: 12.9 },
    { servo_angle_deg: 10, front_dist_cm: 12.6, rear_dist_cm: 12.4, ultrasonic_cm: 13.1 },
    { servo_angle_deg: 15, front_dist_cm: 13.0, rear_dist_cm: 12.8, ultrasonic_cm: 13.5 },
    { servo_angle_deg: 20, front_dist_cm: 13.6, rear_dist_cm: 13.3, ultrasonic_cm: 14.1 },
    { servo_angle_deg: 25, front_dist_cm: 14.5, rear_dist_cm: 14.1, ultrasonic_cm: 15.0 },
    { servo_angle_deg: 30, front_dist_cm: 15.7, rear_dist_cm: 15.3, ultrasonic_cm: 16.2 },
    { servo_angle_deg: 35, front_dist_cm: 17.3, rear_dist_cm: 16.8, ultrasonic_cm: 17.8 },
    { servo_angle_deg: 40, front_dist_cm: 19.5, rear_dist_cm: 18.9, ultrasonic_cm: 20.1 },
    { servo_angle_deg: 45, front_dist_cm: 22.6, rear_dist_cm: 21.8, ultrasonic_cm: 23.2 },
    { servo_angle_deg: 50, front_dist_cm: 27.0, rear_dist_cm: 25.8, ultrasonic_cm: 27.6 },
    { servo_angle_deg: 55, front_dist_cm: 33.2, rear_dist_cm: 31.5, ultrasonic_cm: 33.9 },
    { servo_angle_deg: 60, front_dist_cm: 38.5, rear_dist_cm: 36.8, ultrasonic_cm: 52.3 },
    { servo_angle_deg: 65, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 78.5 },
    { servo_angle_deg: 70, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 95.2 },
    { servo_angle_deg: 75, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 112.8 },
    { servo_angle_deg: 80, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 125.3 },
    { servo_angle_deg: 85, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 132.1 },
    { servo_angle_deg: 90, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 135.6 },
    { servo_angle_deg: 95, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 130.4 },
    { servo_angle_deg: 100, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 120.7 },
    { servo_angle_deg: 105, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 105.3 },
    { servo_angle_deg: 110, front_dist_cm: 40.0, rear_dist_cm: 40.0, ultrasonic_cm: 88.1 },
    { servo_angle_deg: 115, front_dist_cm: 38.8, rear_dist_cm: 37.0, ultrasonic_cm: 70.5 },
    { servo_angle_deg: 120, front_dist_cm: 34.5, rear_dist_cm: 32.8, ultrasonic_cm: 35.2 },
    { servo_angle_deg: 125, front_dist_cm: 28.2, rear_dist_cm: 27.0, ultrasonic_cm: 28.9 },
    { servo_angle_deg: 130, front_dist_cm: 23.5, rear_dist_cm: 22.5, ultrasonic_cm: 24.1 },
    { servo_angle_deg: 135, front_dist_cm: 20.1, rear_dist_cm: 19.3, ultrasonic_cm: 20.7 },
    { servo_angle_deg: 140, front_dist_cm: 17.8, rear_dist_cm: 17.1, ultrasonic_cm: 18.3 },
    { servo_angle_deg: 145, front_dist_cm: 16.0, rear_dist_cm: 15.5, ultrasonic_cm: 16.5 },
    { servo_angle_deg: 150, front_dist_cm: 14.8, rear_dist_cm: 14.4, ultrasonic_cm: 15.3 },
    { servo_angle_deg: 155, front_dist_cm: 13.8, rear_dist_cm: 13.5, ultrasonic_cm: 14.3 },
    { servo_angle_deg: 160, front_dist_cm: 13.1, rear_dist_cm: 12.8, ultrasonic_cm: 13.6 },
    { servo_angle_deg: 165, front_dist_cm: 12.7, rear_dist_cm: 12.5, ultrasonic_cm: 13.2 },
    { servo_angle_deg: 170, front_dist_cm: 12.5, rear_dist_cm: 12.3, ultrasonic_cm: 13.0 },
    { servo_angle_deg: 175, front_dist_cm: 12.4, rear_dist_cm: 12.2, ultrasonic_cm: 12.9 },
    { servo_angle_deg: 180, front_dist_cm: 12.3, rear_dist_cm: 12.1, ultrasonic_cm: 12.8 },
  ],
};

// HTTP helpers 

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function withFallback(requestFn, fallback) {
  return requestFn().catch(() => fallback);
}

// Exported API 

export const fetchSessions = () =>
  withFallback(() => get('/sessions'), mockSessions);

export const fetchScan = (sessionName) =>
  withFallback(
    () => get(`/sessions/${encodeURIComponent(sessionName)}/scan`),
    mockScanData[sessionName] ?? mockScanData['Lab Room A']
  );

export const fetchReadings = (sessionName) =>
  withFallback(
    () => get(`/sessions/${encodeURIComponent(sessionName)}/readings`),
    mockReadings[sessionName] ?? mockReadings['Lab Room A']
  );

export const fetchSensors = (sessionName) =>
  withFallback(
    () => get(`/sessions/${encodeURIComponent(sessionName)}/sensors`),
    [
      { sensorId: 1, name: 'Front IR (GP2Y0A41SK0F)', type: 'IR_SHORT', position: 'Front (0° relative)', rangeNote: '4–40 cm' },
      { sensorId: 2, name: 'Rear IR (GP2Y0A41SK0F)', type: 'IR_SHORT', position: 'Rear (180° relative)', rangeNote: '4–40 cm' },
      { sensorId: 3, name: 'Ultrasonic (HC-SR04)', type: 'ULTRASONIC', position: 'Forward-facing', rangeNote: '2–400 cm' },
      { sensorId: 4, name: 'Servo Motor (SG90)', type: 'SERVO', position: 'Base rotator', rangeNote: '0°–180° at 50Hz PWM' },
    ]
  );

export const fetchBasins = fetchSessions;