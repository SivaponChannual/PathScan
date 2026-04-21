from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import mysql.connector
from mysql.connector import pooling
import os
from datetime import datetime

# ─── App setup ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="PathScan API",
    description="Hybrid IR + Ultrasonic spatial mapping with glass detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    # Lazy-init pool so app startup does not crash when DB is temporarily saturated.
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

    # Fallback direct connect if pool is unavailable.
    return mysql.connector.connect(**DB_CONFIG)


def db_unavailable():
    raise HTTPException(status_code=503, detail="Database temporarily unavailable")


# ─── Pydantic models ──────────────────────────────────────────────────────────
class SensorReadingIn(BaseModel):
    session_id:         int
    primary_dist_cm:    float
    front_short_cm:     float
    rear_short_cm:      float
    ultrasonic_cm:      float
    transparency_index: float
    is_glass:           bool
    material_type:      Optional[str] = None


# ─── Helper: calculate transparency index & material ─────────────────────────
def calculate_ti(primary_dist_cm: float, ultrasonic_cm: float) -> dict:
    delta = abs(primary_dist_cm - ultrasonic_cm)
    ti    = min(delta / 150.0, 1.0)

    if ti > 0.7:
        material = "GLASS"
    elif ti > 0.4:
        material = "ACRYLIC"
    elif ti > 0.2:
        material = "METAL"
    else:
        material = "PLYWOOD"

    return {
        "transparency_index": round(ti, 2),
        "is_glass":           delta > 50,
        "material_type":      material,
    }


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/pathscan-api/v1/sessions")
def get_sessions():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute("SELECT id AS basinId, name, region, created_at FROM sessions")
            return cur.fetchall()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()


@app.get("/pathscan-api/v1/sessions/{session_id}")
def get_session(session_id: int):
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute(
                "SELECT id AS basinId, name, region, created_at FROM sessions WHERE id = %s",
                (session_id,)
            )
            row = cur.fetchone()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@app.get("/pathscan-api/v1/sessions/{session_id}/sensors")
def get_sensors(session_id: int):
    sensors = [
        {"stationId": session_id * 100 + 1, "name": "Front Short IR (GP2Y0A41)", "type": "IR_SHORT",   "rangeNote": "4–30 cm"},
        {"stationId": session_id * 100 + 2, "name": "Rear Short IR (GP2Y0A41)",  "type": "IR_SHORT",   "rangeNote": "4–30 cm"},
        {"stationId": session_id * 100 + 3, "name": "Long Range IR (GP2Y0A02)",  "type": "IR_LONG",    "rangeNote": "20–150 cm"},
        {"stationId": session_id * 100 + 4, "name": "Ultrasonic HC-SR04",        "type": "ULTRASONIC", "rangeNote": "2–400 cm"},
    ]
    return sensors


@app.post("/pathscan-api/v1/readings")
def post_reading(reading: SensorReadingIn):
    computed = calculate_ti(reading.primary_dist_cm, reading.ultrasonic_cm)
    ti       = reading.transparency_index or computed["transparency_index"]
    is_glass = reading.is_glass           or computed["is_glass"]
    material = reading.material_type      or computed["material_type"]

    try:
        db  = get_db()
        cur = db.cursor()
        try:
            cur.execute(
                """INSERT INTO sensor_readings
                   (session_id, primary_dist_cm, front_short_cm, rear_short_cm,
                    ultrasonic_cm, transparency_index, is_glass, material_type)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (reading.session_id, reading.primary_dist_cm, reading.front_short_cm,
                 reading.rear_short_cm, reading.ultrasonic_cm, ti, is_glass, material)
            )
            db.commit()
            inserted_id = cur.lastrowid
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()

    return {"id": inserted_id, "transparency_index": ti, "is_glass": is_glass, "material_type": material}


@app.get("/pathscan-api/v1/sessions/{session_id}/readings/latest")
def get_latest_reading(session_id: int):
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute(
                """SELECT
                     primary_dist_cm    AS primaryDistCm,
                     front_short_cm     AS frontShortCm,
                     rear_short_cm      AS rearShortCm,
                     ultrasonic_cm      AS ultrasonicCm,
                     transparency_index AS transparencyIndex,
                     is_glass           AS isGlass,
                     material_type      AS materialType,
                     timestamp
                   FROM sensor_readings
                   WHERE session_id = %s
                   ORDER BY timestamp DESC
                   LIMIT 1""",
                (session_id,)
            )
            row = cur.fetchone()
        finally:
            cur.close()
            db.close()
    except mysql.connector.Error:
        db_unavailable()

    if not row:
        raise HTTPException(status_code=404, detail="No readings found")
    row["isGlass"] = bool(row["isGlass"])
    return row


@app.get("/pathscan-api/v1/sessions/{session_id}/readings")
def get_recent_readings(session_id: int, limit: int = Query(default=60, ge=1, le=240)):
    try:
        db = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute(
                """SELECT
                     primary_dist_cm    AS primaryDistCm,
                     front_short_cm     AS frontShortCm,
                     rear_short_cm      AS rearShortCm,
                     ultrasonic_cm      AS ultrasonicCm,
                     transparency_index AS transparencyIndex,
                     is_glass           AS isGlass,
                     material_type      AS materialType,
                     timestamp
                   FROM sensor_readings
                   WHERE session_id = %s
                   ORDER BY timestamp DESC
                   LIMIT %s""",
                (session_id, limit)
            )
            rows = cur.fetchall()
        finally:
            cur.close()
            db.close()
    except mysql.connector.Error:
        db_unavailable()

    # Return oldest -> newest so frontend can render a natural scan history.
    rows.reverse()
    for row in rows:
        row["isGlass"] = bool(row["isGlass"])
    return rows


@app.get("/pathscan-api/v1/sessions/{session_id}/transparency-index")
def get_transparency_index(session_id: int):
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute(
                """SELECT
                     FLOOR((ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp) - 1) * 15) AS angle,
                     transparency_index AS transparencyIndex,
                     material_type      AS materialType
                   FROM sensor_readings
                   WHERE session_id = %s
                   ORDER BY timestamp ASC""",
                (session_id,)
            )
            return cur.fetchall()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()


@app.get("/pathscan-api/v1/materials")
def get_materials():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        try:
            cur.execute("SELECT * FROM material_reference")
            return cur.fetchall()
        finally:
            cur.close(); db.close()
    except mysql.connector.Error:
        db_unavailable()


# ─── Run ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)