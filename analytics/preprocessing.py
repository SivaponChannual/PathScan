"""
PathScan v2.0 — Preprocessing module
Converts raw serial CSV data (angle, front_cm, rear_cm, ultrasonic_cm)
into a 360° cartesian point cloud.
"""
import math

# Hardware limits
IR_MIN_CM = 4.0
IR_MAX_CM = 40.0
US_MIN_CM = 2.0
US_MAX_CM = 400.0


def clamp_ir(value):
    """Clamp to GP2Y0A41SK0F reliable range."""
    if value is None:
        return None
    return max(IR_MIN_CM, min(IR_MAX_CM, value))


def clamp_us(value):
    """Clamp to HC-SR04 reliable range."""
    if value is None:
        return None
    return max(US_MIN_CM, min(US_MAX_CM, value))


def polar_to_cartesian(dist_cm, angle_deg):
    """Convert polar (distance, angle) to cartesian (x, y)."""
    rad = math.radians(angle_deg)
    return (
        round(dist_cm * math.cos(rad), 2),
        round(dist_cm * math.sin(rad), 2),
    )


def parse_csv_line(line):
    """Parse a single CSV line: angle,front_cm,rear_cm,ultrasonic_cm"""
    parts = line.strip().split(",")
    if len(parts) != 4:
        return None
    try:
        return {
            "servo_angle_deg": int(parts[0]),
            "front_dist_cm": float(parts[1]),
            "rear_dist_cm": float(parts[2]),
            "ultrasonic_cm": float(parts[3]),
        }
    except ValueError:
        return None


def build_point_cloud(readings):
    """
    Convert list of raw readings into a 360° cartesian point cloud.
    Each reading produces 2 points (front + rear sensor).

    Args:
        readings: list of dicts with servo_angle_deg, front_dist_cm,
                  rear_dist_cm, ultrasonic_cm

    Returns:
        list of point dicts with x, y, true_angle_deg, dist_cm, sensor, etc.
    """
    points = []

    for r in readings:
        servo = r["servo_angle_deg"]
        front = clamp_ir(r["front_dist_cm"])
        rear = clamp_ir(r["rear_dist_cm"])
        us = clamp_us(r.get("ultrasonic_cm"))

        # Front sensor: true angle = servo angle
        if front is not None and IR_MIN_CM <= front <= IR_MAX_CM:
            fx, fy = polar_to_cartesian(front, servo)
            delta = round(abs(us - front), 1) if us else None
            points.append({
                "sensor": "front",
                "servo_angle_deg": servo,
                "true_angle_deg": servo,
                "dist_cm": front,
                "ultrasonic_cm": us,
                "ir_us_delta": delta,
                "x": fx,
                "y": fy,
            })

        # Rear sensor: true angle = (servo + 180) % 360
        if rear is not None and IR_MIN_CM <= rear <= IR_MAX_CM:
            rear_angle = (servo + 180) % 360
            rx, ry = polar_to_cartesian(rear, rear_angle)
            points.append({
                "sensor": "rear",
                "servo_angle_deg": servo,
                "true_angle_deg": rear_angle,
                "dist_cm": rear,
                "ultrasonic_cm": None,
                "ir_us_delta": None,
                "x": rx,
                "y": ry,
            })

    return points


if __name__ == "__main__":
    # Demo with sample data
    sample = [
        {"servo_angle_deg": 0,  "front_dist_cm": 20.3, "rear_dist_cm": 19.8, "ultrasonic_cm": 20.8},
        {"servo_angle_deg": 45, "front_dist_cm": 28.6, "rear_dist_cm": 28.3, "ultrasonic_cm": 29.1},
        {"servo_angle_deg": 90, "front_dist_cm": 15.0, "rear_dist_cm": 14.8, "ultrasonic_cm": 15.4},
    ]
    cloud = build_point_cloud(sample)
    for p in cloud:
        print(f"  {p['sensor']:5s}  angle={p['true_angle_deg']:3d}°  "
              f"dist={p['dist_cm']:5.1f}cm  ({p['x']:7.2f}, {p['y']:7.2f})")
