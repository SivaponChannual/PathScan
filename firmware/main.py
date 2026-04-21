"""
PathScan v2.0 — MicroPython Firmware for KidBright32 (ESP32)
Sweep servo 0°→180°, read dual IR + ultrasonic at each step,
output CSV over serial: servo_angle, front_cm, rear_cm, ultrasonic_cm

Hardware wiring:
  SG90 Servo  → SV1 / GPIO 15 (PWM 50Hz)
  Front IR    → I1  / GPIO 32 (ADC, 11dB atten)
  Rear IR     → I2  / GPIO 33 (ADC, 11dB atten)
  HC-SR04 Trig→ GPIO 25
  HC-SR04 Echo→ GPIO 26
"""

from machine import Pin, PWM, ADC
import time

# ─── Pin setup ────────────────────────────────────────────────────────────────
servo_pin = PWM(Pin(15), freq=50)

adc_front = ADC(Pin(32))
adc_front.atten(ADC.ATTN_11DB)   # Full 3.3V range

adc_rear = ADC(Pin(33))
adc_rear.atten(ADC.ATTN_11DB)

trig_pin = Pin(25, Pin.OUT)
echo_pin = Pin(26, Pin.IN)

# ─── Constants ────────────────────────────────────────────────────────────────
STEP_DEG      = 5       # Angle increment per sweep step
SETTLE_MS     = 30      # Delay for servo + sensor settle
IR_SAMPLES    = 5       # ADC oversampling for noise reduction
IR_MIN_CM     = 4.0     # GP2Y0A41SK0F minimum reliable range
IR_MAX_CM     = 40.0    # GP2Y0A41SK0F maximum reliable range
US_TIMEOUT_US = 25000   # HC-SR04 echo timeout (~400 cm)

# ─── Servo helper ─────────────────────────────────────────────────────────────
def set_servo_angle(angle):
    """
    Set SG90 to a specific angle (0-180°).
    Duty formula for ESP32 at 50Hz (period=20ms):
      duty = 40 + (angle/180) * 75
    Maps 0°→duty~40 (1ms pulse), 180°→duty~115 (2ms pulse).
    """
    duty = int(40 + (angle / 180) * 75)
    servo_pin.duty(duty)

# ─── IR distance helper ───────────────────────────────────────────────────────
def read_ir_cm(adc):
    """
    Read GP2Y0A41SK0F analog output and convert to distance (cm).
    Uses oversampling (average N reads) then power-law regression:
      V = raw * (3.3 / 4095)
      dist = 12.35 * V^(-1.05)
    Clamped to [IR_MIN_CM, IR_MAX_CM].
    """
    total = 0
    for _ in range(IR_SAMPLES):
        total += adc.read()
        time.sleep_us(200)
    raw = total / IR_SAMPLES

    if raw < 10:
        return IR_MAX_CM  # No reflection = max range

    voltage = raw * (3.3 / 4095.0)
    if voltage < 0.05:
        return IR_MAX_CM

    dist = 12.35 * (voltage ** -1.05)

    # Clamp to sensor reliable range
    if dist < IR_MIN_CM:
        dist = IR_MIN_CM
    elif dist > IR_MAX_CM:
        dist = IR_MAX_CM

    return round(dist, 1)

# ─── Ultrasonic distance helper ───────────────────────────────────────────────
def read_ultrasonic_cm():
    """
    Read HC-SR04: send 10µs trigger pulse, measure echo duration.
    Distance = (echo_time_us / 2) / 29.1
    Clamped to [2, 400] cm.
    """
    # Send trigger pulse
    trig_pin.value(0)
    time.sleep_us(2)
    trig_pin.value(1)
    time.sleep_us(10)
    trig_pin.value(0)

    # Wait for echo to go HIGH
    timeout = time.ticks_us()
    while echo_pin.value() == 0:
        if time.ticks_diff(time.ticks_us(), timeout) > US_TIMEOUT_US:
            return 400.0  # Nothing detected within range
    start = time.ticks_us()

    # Wait for echo to go LOW
    while echo_pin.value() == 1:
        if time.ticks_diff(time.ticks_us(), start) > US_TIMEOUT_US:
            return 400.0
    end = time.ticks_us()

    duration = time.ticks_diff(end, start)
    dist = (duration / 2.0) / 29.1

    if dist < 2.0:
        dist = 2.0
    elif dist > 400.0:
        dist = 400.0

    return round(dist, 1)

# ─── Main sweep loop ─────────────────────────────────────────────────────────
def sweep():
    """
    Perform one full 0°→180° sweep.
    At each step: set servo, wait, read all sensors, print CSV.
    Output format: servo_angle, front_cm, rear_cm, ultrasonic_cm
    """
    print("--- SWEEP START ---")
    print("angle,front_cm,rear_cm,ultrasonic_cm")

    for angle in range(0, 181, STEP_DEG):
        set_servo_angle(angle)
        time.sleep_ms(SETTLE_MS)

        front_cm = read_ir_cm(adc_front)
        rear_cm  = read_ir_cm(adc_rear)
        us_cm    = read_ultrasonic_cm()

        print("{},{},{},{}".format(angle, front_cm, rear_cm, us_cm))

    print("--- SWEEP END ---")

# ─── Entry point ──────────────────────────────────────────────────────────────
print("PathScan v2.0 — Firmware Ready")
print("Sensors: 2x GP2Y0A41SK0F + HC-SR04 on SG90")
print("Sweep step: {}°, Settle: {}ms".format(STEP_DEG, SETTLE_MS))

# Center servo on boot
set_servo_angle(90)
time.sleep_ms(500)

# Continuous sweep loop
while True:
    sweep()
    time.sleep(1)  # Brief pause between sweeps
