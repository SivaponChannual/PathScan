# 🛰️ PathScan
> **Precision 360° LiDAR-style Sweeping Radar System**

PathScan is a spatial mapping and environment rendering system. It utilizes a rotating sensor array connected to a KidBright32 (ESP32) microcontroller to scan a room and transmit distance telemetry to a centralized database. The React-based dashboard instantly renders this data into interactive 2D blueprints and 2.5D isometric reconstructions, using a pure-Python DBSCAN clustering algorithm to identify solid obstacles.

---

## ⚙️ Hardware Architecture

The DAQ (Data Acquisition) array consists of a dual-sensor hybrid system mounted on a 180° sweeping servo, allowing for full 360° vision.

| Component | Port (KidBright) | GPIO (ESP32) | Function | Range / Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Servo Motor** *(SG90)* | SV1 | GPIO 15 | Rotating Base | Sweeps 0°–180° at 50Hz PWM |
| **Front IR** *(GP2Y0A41SK0F)* | I1 | GPIO 32 | Primary Short-Range Vision | Reliable: 4–30 cm (Capped at 40cm) |
| **Rear IR** *(GP2Y0A41SK0F)* | I2 | GPIO 33 | Rear Short-Range Vision | Reliable: 4–30 cm (Capped at 40cm) |
| **Ultrasonic** *(HC-SR04)* | Trig/Echo | GPIO 25 & 26 | Secondary Distance/Safety | Reliable: 2–400 cm |

*Note: The hardware logic requires an external 5V supply for stable servo operation, while the logic signaling uses ESP32 3.3V logic.*

---

## 💻 Tech Stack

*   **Firmware:** MicroPython (ESP32 / KidBright32)
*   **Backend API:** Python + FastAPI + Uvicorn
*   **Database:** MySQL (Hosted on `iot.cpe.ku.ac.th/pma/`)
*   **Frontend UI:** React + Vite + Recharts + CSS Modules
*   **Analytics:** Pure-Python DBSCAN Clustering (No scikit-learn dependency)

---

## 🚀 Installation & Setup

### 1. Database Setup
1. Open phpMyAdmin at `https://iot.cpe.ku.ac.th/pma/`
2. Create or navigate to your target database.
3. Import the exact SQL schema and mock data included in `Ack/scan_telemetry.sql`.
4. This ensures the backend has the correct 1-table `scan_telemetry` schema.

### 2. Backend Setup (FastAPI)
Navigate to the backend directory, install requirements, configure the `.env`, and start the server:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
DB_HOST=iot.cpe.ku.ac.th
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_db_name
DB_PORT=3306
DB_POOL_SIZE=5
```

Start the FastAPI server (Runs on port `8000`):
```bash
python main.py
```

### 3. Frontend Setup (React/Vite)
Open a new terminal session, install Node dependencies, and start Vite:
```bash
# In the root PathScan/ directory
npm install
npm run dev
```
The dashboard will open at `http://localhost:5173/`.

### 4. Firmware Deployment (MicroPython)
1. Connet the KidBright32 via Micro-USB.
2. Flash the scripts located in the `firmware/` folder (`boot.py` and `main.py`) to the board using a tool like Thonny or ampy.
3. Once booted, the device will immediately begin executing `0°->180°` servo sweeps and printing CSV telemetry over Serial. Example output:
   `angle,front_cm,rear_cm,ultrasonic_cm`

---

## 🧠 Software Features

*   **True Cartesian Rendering:** The Python backend intercepts polar coordinates (servo angle + IR distance) and converts them to precise (X,Y) cartesian grids in real-time.
*   **DBSCAN Obstacle Detection:** Custom implementation of Density-Based Spatial Clustering of Applications with Noise detects tight groupings of points (spikes) to flag furniture legs, trash cans, and architectural anomalies in red.
*   **2.5D Isometric Engine:** The dashboard utilizes an HTML5 Canvas drawing technique combined with the Painter's Algorithm to instantly extrude 2D floor plans into depth-sorted 3D pillars.
*   **Safety Fallback:** If the live MySQL database is unreachable, the Dashboard gracefully degrades to a locally rendered simulated Mock Room allowing UI/UX development to continue undisturbed.
