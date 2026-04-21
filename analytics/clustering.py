"""
PathScan v2.0 — DBSCAN Clustering module
Pure-Python implementation (no scikit-learn dependency).
Identifies structural obstacles (furniture, pillars) in the point cloud
by clustering spatially close points that deviate from the wall pattern.
"""
import math


def euclidean_distance(p1, p2):
    """Euclidean distance between two points (dicts with 'x' and 'y')."""
    dx = p1["x"] - p2["x"]
    dy = p1["y"] - p2["y"]
    return math.sqrt(dx * dx + dy * dy)


def dbscan(points, eps=5.0, min_samples=2):
    """
    DBSCAN clustering algorithm.

    Args:
        points:      list of dicts, each with 'x' and 'y' keys
        eps:         maximum distance between two points in a cluster (cm)
        min_samples: minimum points to form a dense region

    Returns:
        list of integer labels (same length as points).
        -1 = noise (not part of any cluster)
         0, 1, 2, ... = cluster ID
    """
    n = len(points)
    labels = [-1] * n
    cluster_id = 0
    visited = [False] * n

    def region_query(idx):
        """Find all points within eps distance of points[idx]."""
        neighbors = []
        for j in range(n):
            if euclidean_distance(points[idx], points[j]) <= eps:
                neighbors.append(j)
        return neighbors

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        neighbors = region_query(i)

        if len(neighbors) < min_samples:
            # Noise point
            labels[i] = -1
            continue

        # Start a new cluster
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


def label_obstacles(points, eps=5.0, min_samples=2):
    """
    Run DBSCAN on a point cloud and annotate each point with
    'cluster' (int) and 'is_obstacle' (bool) fields.

    Args:
        points: list of point dicts (must have 'x' and 'y')
        eps:    DBSCAN epsilon (cm)
        min_samples: DBSCAN min_samples

    Returns:
        The same list of points, mutated with added fields.
    """
    if len(points) < min_samples:
        for p in points:
            p["cluster"] = -1
            p["is_obstacle"] = False
        return points

    labels = dbscan(points, eps=eps, min_samples=min_samples)
    for i, label in enumerate(labels):
        points[i]["cluster"] = label
        points[i]["is_obstacle"] = label >= 0

    return points


def summarize_clusters(points):
    """
    Print a summary of detected clusters.
    """
    clusters = {}
    noise_count = 0

    for p in points:
        cid = p.get("cluster", -1)
        if cid == -1:
            noise_count += 1
        else:
            if cid not in clusters:
                clusters[cid] = []
            clusters[cid].append(p)

    print(f"Total points: {len(points)}")
    print(f"Noise points: {noise_count}")
    print(f"Clusters found: {len(clusters)}")

    for cid, members in sorted(clusters.items()):
        avg_x = sum(p["x"] for p in members) / len(members)
        avg_y = sum(p["y"] for p in members) / len(members)
        avg_d = sum(p["dist_cm"] for p in members) / len(members)
        angles = [p["true_angle_deg"] for p in members]
        print(f"  Cluster {cid}: {len(members)} pts, "
              f"center=({avg_x:.1f}, {avg_y:.1f}), "
              f"avg_dist={avg_d:.1f}cm, "
              f"angles={min(angles)}°–{max(angles)}°")


if __name__ == "__main__":
    # Demo: simulate some wall points + an obstacle cluster
    from preprocessing import build_point_cloud

    readings = [
        {"servo_angle_deg": a, "front_dist_cm": 20.0, "rear_dist_cm": 20.0, "ultrasonic_cm": 20.5}
        for a in range(0, 181, 5)
    ]
    # Inject obstacle at 30-40°
    for r in readings:
        if 30 <= r["servo_angle_deg"] <= 40:
            r["front_dist_cm"] = 8.0
            r["ultrasonic_cm"] = 8.3

    cloud = build_point_cloud(readings)
    labeled = label_obstacles(cloud, eps=5.0, min_samples=2)
    summarize_clusters(labeled)
