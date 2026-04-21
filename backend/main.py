"""
PathScan v2.0 — FastAPI Backend
Single table: scan_telemetry
Sensors: 2× GP2Y0A41SK0F (4-40 cm) + 1× HC-SR04 (2-400 cm) on SG90 servo
No transparency_index / is_glass / material_type — those are not physically measurable.
The raw delta between IR and ultrasonic IS real data the hardware produces.
"""
from dotenv import load_dotenv
load_dotenv()

import math
import random
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector
from mysql.connector import pooling
import os
from datetime import datetime

# ─── App setup ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="PathScan API v2",
    description=(
        "Dual IR (GP2Y0A41SK0F) + Ultrasonic (HC-SR04) sweep radar · "
        "SG90 servo · 360° spatial mapping"
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Sensor hardware constants ───────────────────────────────────────────────
IR_MIN_CM  = 4.0      # GP2Y0A41SK0F minimum reliable range
IR_MAX_CM  = 40.0     # GP2Y0A41SK0F maximum readable distance
US_MIN_CM  = 2.0      # HC-SR04 minimum range
US_MAX_CM  = 400.0    # HC-SR04 maximum range
SERVO_MIN  = 0        # SG90 min angle
SERVO_MAX  = 180      # SG90 max angle

# ─── DB connection ────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host":     os.getenv("DB_HOST"),
    "port":     int(os.getenv("DB_PORT", "3306")),
    "database": os.getenv("DB_NAME"),
    "user":     os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
}

DB_POOL = None

def get_db():
    global DB_POOL
    if DB_POOL is None:
        try:
            DB_POOL = pooling.MySQLConnectionPool(
                pool_name="pathscan_pool",
                pool_size=int(os.getenv("DB_POOL_SIZE", "2")),
                pool_reset_session=True,
                **DB_CONFIG,
            )
        except mysql.connector.Error:
            DB_POOL = False

    if DB_POOL:
        try:
            return DB_POOL.get_connection()
        except mysql.connector.Error:
            pass

    return mysql.connector.connect(**DB_CONFIG)


def db_unavailable():
    raise HTTPException(status_code=503, detail="Database temporarily unavailable")


# ─── Pydantic models ──────────────────────────────────────────────────────────
class ScanReadingIn(BaseModel):
    session_name: str = "Default Session"
    servo_angle_deg: int
    front_dist_cm: float
    rear_dist_cm: float
    ultrasonic_cm: Optional[float] = None


# ─── Math helpers ─────────────────────────────────────────────────────────────
def clamp_ir(value: float) -> Optional[float]:
    """Clamp a distance to the GP2Y0A41SK0F reliable range."""
    if value is None:
        return None
    if value < IR_MIN_CM:
        return IR_MIN_CM
    if value > IR_MAX_CM:
        return IR_MAX_CM
    return round(value, 1)


def clamp_us(value: float) -> Optional[float]:
    """Clamp a distance to the HC-SR04 reliable range."""
    if value is None:
        return None
    if value < US_MIN_CM:
        return US_MIN_CM
    if value > US_MAX_CM:
        return US_MAX_CM
    return round(value, 1)


def polar_to_cartesian(dist_cm: float, angle_deg: int) -> dict:
    """Convert polar (distance, angle) to cartesian (x, y)."""
    rad = math.radians(angle_deg)
    return {
        "x": round(dist_cm * math.cos(rad), 2),
        "y": round(dist_cm * math.sin(rad), 2),
    }


def dbscan_cluster(points: list, eps: float = 5.0, min_samples: int = 2) -> list:
    """
    Simple DBSCAN implementation — no scikit-learn dependency.
    Each point is a dict with 'x' and 'y'.
    Returns list of cluster labels (-1 = noise).
    """
    n = len(points)
    labels = [-1] * n
    cluster_id = 0

    def region_query(idx):
        neighbors = []
        px, py = points[idx]["x"], points[idx]["y"]
        for j in range(n):
            dx = points[j]["x"] - px
            dy = points[j]["y"] - py
            if math.sqrt(dx * dx + dy * dy) <= eps:
                neighbors.append(j)
        return neighbors

    visited = [False] * n

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        neighbors = region_query(i)

        if len(neighbors) < min_samples:
            labels[i] = -1
            continue

        labels[i] = cluster_id
        seed_set = list(neighbors)
        j = 0
        while j < len(seed_set):
            q = seed_set[j]
            if not visited[q]:
                visited[q] = True
                q_neighbors = region_query(q)
                if len(q_neighbors) >= min_samples:
                    seed_set.extend(q_neighbors)
            if labels[q] == -1:
                labels[q] = cluster_id
            j += 1

        cluster_id += 1

    return labels


def build_360_points(rows: list) -> list:
    """
    Take DB rows and expand each into 2 points (front + rear sensor),
    compute cartesian coords, then run DBSCAN.
    Also attach the ultrasonic reading and IR-vs-US delta for each point.
    """
    points = []

    for row in rows:
        servo_angle = row["servo_angle_deg"]
        front_dist  = row["front_dist_cm"]
        rear_dist   = row["rear_dist_cm"]
        us_dist     = row.get("ultrasonic_cm")

        # Front sensor: true angle = servo angle
        if front_dist is not None and IR_MIN_CM <= front_dist <= IR_MAX_CM:
            front_angle = servo_angle
            cart = polar_to_cartesian(front_dist, front_angle)
            delta = round(abs(us_dist - front_dist), 1) if us_dist else None
            points.append({
                "sensor": "front",
                "servo_angle_deg": servo_angle,
                "true_angle_deg": front_angle,
                "dist_cm": front_dist,
                "ultrasonic_cm": us_dist,
                "ir_us_delta": delta,
                "x": cart["x"],
                "y": cart["y"],
            })

        # Rear sensor: true angle = (servo_angle + 180) % 360
        if rear_dist is not None and IR_MIN_CM <= rear_dist <= IR_MAX_CM:
            rear_angle = (servo_angle + 180) % 360
            cart = polar_to_cartesian(rear_dist, rear_angle)
            # US only faces forward, so rear doesn't get a delta
            points.append({
                "sensor": "rear",
                "servo_angle_deg": servo_angle,
                "true_angle_deg": rear_angle,
                "dist_cm": rear_dist,
                "ultrasonic_cm": None,
                "ir_us_delta": None,
                "x": cart["x"],
                "y": cart["y"],
            })

    # Run DBSCAN to identify clusters (obstacles)
    if len(points) >= 2:
        labels = dbscan_cluster(points, eps=5.0, min_samples=2)
        for i, label in enumerate(labels):
            points[i]["cluster"] = label
            points[i]["is_obstacle"] = label >= 0
    else:
        for p in points:
            p["cluster"] = -1
            p["is_obstacle"] = False

    return points


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/pathscan-api/v1/sessions")
def get_sessions():
    """Get distinct scan sessions from the single table."""
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT
                    session_name AS name,
                    MIN(id) AS sessionId,
                    COUNT(*) AS pointCount,
                    MIN(timestamp) AS startedAt,
                    MAX(timestamp) AS endedAt
                FROM scan_telemetry
                GROUP BY session_name
                ORDER BY MIN(timestamp) DESC
            """)
            return cur.fetchall()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()


@app.get("/pathscan-api/v1/sessions/{session_name}/scan")
def get_scan(session_name: str):
    """
    Get the full 360° point cloud for a session.
    Returns raw rows + computed cartesian coordinates + DBSCAN cluster labels.
    """
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT servo_angle_deg, front_dist_cm, rear_dist_cm,
                       ultrasonic_cm, timestamp
                FROM scan_telemetry
                WHERE session_name = %s
                ORDER BY servo_angle_deg ASC
            """, (session_name,))
            rows = cur.fetchall()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()

    if not rows:
        raise HTTPException(status_code=404, detail="No scan data for this session")

    points = build_360_points(rows)
    cluster_ids = set(p["cluster"] for p in points if p["cluster"] >= 0)

    return {
        "session_name": session_name,
        "raw_readings": len(rows),
        "total_points": len(points),
        "clusters_found": len(cluster_ids),
        "sensor_spec": {
            "ir_model": "GP2Y0A41SK0F",
            "ir_min_cm": IR_MIN_CM,
            "ir_max_cm": IR_MAX_CM,
            "us_model": "HC-SR04",
            "us_min_cm": US_MIN_CM,
            "us_max_cm": US_MAX_CM,
        },
        "points": points,
    }


@app.get("/pathscan-api/v1/sessions/{session_name}/readings")
def get_readings(session_name: str):
    """Get raw telemetry rows for a session (for the distance chart)."""
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT id, servo_angle_deg, front_dist_cm, rear_dist_cm,
                       ultrasonic_cm, timestamp
                FROM scan_telemetry
                WHERE session_name = %s
                ORDER BY servo_angle_deg ASC
            """, (session_name,))
            return cur.fetchall()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()


@app.get("/pathscan-api/v1/sessions/{session_name}/sensors")
def get_sensors(session_name: str):
    """Return the hardware sensor array for this station."""
    return [
        {
            "sensorId": 1,
            "name": "Front IR (GP2Y0A41SK0F)",
            "type": "IR_SHORT",
            "position": "Front (0° relative)",
            "rangeNote": f"{IR_MIN_CM}–{IR_MAX_CM} cm",
        },
        {
            "sensorId": 2,
            "name": "Rear IR (GP2Y0A41SK0F)",
            "type": "IR_SHORT",
            "position": "Rear (180° relative)",
            "rangeNote": f"{IR_MIN_CM}–{IR_MAX_CM} cm",
        },
        {
            "sensorId": 3,
            "name": "Ultrasonic (HC-SR04)",
            "type": "ULTRASONIC",
            "position": "Forward-facing",
            "rangeNote": f"{US_MIN_CM}–{US_MAX_CM} cm",
        },
        {
            "sensorId": 4,
            "name": "Servo Motor (SG90)",
            "type": "SERVO",
            "position": "Base rotator",
            "rangeNote": f"{SERVO_MIN}°–{SERVO_MAX}° at 50Hz PWM",
        },
    ]


@app.post("/pathscan-api/v1/readings")
def post_reading(reading: ScanReadingIn):
    """Ingest a single reading from KidBright32 serial/MQTT."""
    front = clamp_ir(reading.front_dist_cm)
    rear  = clamp_ir(reading.rear_dist_cm)
    us    = clamp_us(reading.ultrasonic_cm) if reading.ultrasonic_cm else None

    try:
        db = get_db()
        cur = db.cursor()
        try:
            cur.execute(
                """INSERT INTO scan_telemetry
                   (session_name, servo_angle_deg, front_dist_cm, rear_dist_cm, ultrasonic_cm)
                   VALUES (%s, %s, %s, %s, %s)""",
                (reading.session_name, reading.servo_angle_deg, front, rear, us)
            )
            db.commit()
            inserted_id = cur.lastrowid
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()

    return {
        "id": inserted_id,
        "front_dist_cm": front,
        "rear_dist_cm": rear,
        "ultrasonic_cm": us,
        "front_true_angle": reading.servo_angle_deg,
        "rear_true_angle": (reading.servo_angle_deg + 180) % 360,
    }


# ─── Mock data generator endpoint (for simulation/demo) ──────────────────────
@app.get("/pathscan-api/v1/mock/generate-room")
def generate_mock_room(
    half_w: float = Query(default=20.0, description="Half-width of room in cm"),
    half_d: float = Query(default=15.0, description="Half-depth of room in cm"),
    step: int = Query(default=5, description="Angle step in degrees"),
    obstacle_angle: int = Query(default=35, description="Obstacle center angle"),
    obstacle_dist: float = Query(default=8.0, description="Obstacle distance cm"),
    obstacle_spread: int = Query(default=10, description="Obstacle angular width"),
):
    """
    Generate a mock room scan without writing to DB.
    Uses rectangular room intersection + noise + obstacle spike.
    All values clamped to hardware limits.
    """
    points = []

    for servo_angle in range(0, 181, step):
        front_angle = servo_angle
        rear_angle = (servo_angle + 180) % 360

        # Compute wall distance for front
        front_rad = math.radians(front_angle)
        cos_f = abs(math.cos(front_rad)) + 0.001
        sin_f = abs(math.sin(front_rad)) + 0.001
        front_wall = min(half_w / cos_f, half_d / sin_f)

        # Compute wall distance for rear (same room)
        rear_rad = math.radians(rear_angle)
        cos_r = abs(math.cos(rear_rad)) + 0.001
        sin_r = abs(math.sin(rear_rad)) + 0.001
        rear_wall = min(half_w / cos_r, half_d / sin_r)

        # US sees same as front IR, but further
        us_wall = front_wall * 1.0 + random.uniform(0, 0.8)

        # ADC noise
        front_dist = front_wall + random.uniform(-0.3, 0.3)
        rear_dist  = rear_wall  + random.uniform(-0.3, 0.3)
        us_dist    = us_wall    + random.uniform(-0.5, 0.5)

        # Overlay obstacle on front sensor (both IR and US see it)
        if abs(servo_angle - obstacle_angle) <= obstacle_spread:
            front_dist = obstacle_dist + random.uniform(-0.2, 0.2)
            us_dist    = obstacle_dist + random.uniform(-0.1, 0.3)

        # Clamp to hardware limits
        front_dist = clamp_ir(front_dist)
        rear_dist  = clamp_ir(rear_dist)
        us_dist    = clamp_us(us_dist)

        if front_dist:
            fc = polar_to_cartesian(front_dist, front_angle)
            delta = round(abs(us_dist - front_dist), 1) if us_dist else None
            points.append({
                "sensor": "front", "servo_angle_deg": servo_angle,
                "true_angle_deg": front_angle, "dist_cm": front_dist,
                "ultrasonic_cm": us_dist, "ir_us_delta": delta,
                **fc,
            })
        if rear_dist:
            rc = polar_to_cartesian(rear_dist, rear_angle)
            points.append({
                "sensor": "rear", "servo_angle_deg": servo_angle,
                "true_angle_deg": rear_angle, "dist_cm": rear_dist,
                "ultrasonic_cm": None, "ir_us_delta": None,
                **rc,
            })

    # DBSCAN
    if len(points) >= 2:
        labels = dbscan_cluster(points, eps=5.0, min_samples=2)
        for i, label in enumerate(labels):
            points[i]["cluster"] = label
            points[i]["is_obstacle"] = label >= 0

    return {"total_points": len(points), "points": points}


# ─── Root & docs ──────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "project": "PathScan v2.0",
        "docs": "/docs",
        "description": (
            "Dual GP2Y0A41SK0F + HC-SR04 on SG90 servo · "
            "360° spatial mapping · DBSCAN clustering"
        ),
    }


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)