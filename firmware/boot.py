"""
PathScan v2.0 — Boot file for KidBright32 (ESP32)
This runs before main.py on every power-on.
"""
import gc
gc.collect()
print("PathScan v2.0 booting...")
