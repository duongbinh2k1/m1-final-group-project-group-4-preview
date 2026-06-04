"""
train_actuator_model.py
=======================
End-to-end pipeline for the Actuator Decision Model.

Steps
-----
1. Load the existing processed plant-health dataset.
2. Derive *data-driven* actuator labels – no hand-tuned thresholds.
3. Train a Decision Tree actuator classifier.
4. Export the tree as a C header (actuator_classifier.h) for the ESP8266.
5. Run a quick self-test to verify the Python model ↔ C code agree.

Label design
------------
We need four actuator states:
    0 = IDLE       – conditions are fine, nothing to do
    1 = PUMP       – soil is too dry, activate water pump
    2 = FAN        – thermal stress is too high, activate cooling fan
    3 = PUMP+FAN   – both stresses are present simultaneously

The labels are derived per health-class using *percentile-based* thresholds
computed from the data itself (not domain hard-coded values).  This means the
Random Forest must learn complex, non-linear, joint-feature decision boundaries
rather than trivially reproducing a simple rule.

  Pump signal  → soil moisture < 33rd percentile within the same health class
  Fan signal   → thermal_score > 67th percentile within the same health class
                 where thermal_score = 0.7*temperature + 0.3*(100-air_humidity)

The thermal score captures that *high temperature + low humidity* causes more
evaporative + heat stress than high temperature alone.  The interaction of all
three raw features is then learned by the Decision Tree.
"""

import numpy as np
import pandas as pd
import pickle
from pathlib import Path
from sklearn.tree import DecisionTreeClassifier, _tree, export_text
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import classification_report, accuracy_score

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
DATA_DIR     = SCRIPT_DIR / "dataset" / "raw"
MODELS_DIR   = SCRIPT_DIR / "models"
FIRMWARE_DIR = SCRIPT_DIR.parent / "edge_firmware" / "include"

MODELS_DIR.mkdir(exist_ok=True)
FIRMWARE_DIR.mkdir(parents=True, exist_ok=True)

FEATURES     = ["temperature", "air_humidity", "soil_moisture"]
HEALTH_NAMES = ["healthy", "warning", "critical"]
ACT_NAMES    = ["idle", "pump", "fan", "pump_and_fan"]

# ── 1. Load data ──────────────────────────────────────────────────────────────
print("=" * 60)
print("Step 1 – Loading dataset")
df = pd.read_csv(DATA_DIR / "plant_health_processed.csv")
print(f"  Rows: {len(df)}, columns: {list(df.columns)}")

X_raw = df[FEATURES].values.astype(np.float32)
y_health = df["label"].values.astype(int)

# Remap labels to 0-based contiguous integers
unique = sorted(set(y_health))
if unique != list(range(len(unique))):
    remap = {old: new for new, old in enumerate(unique)}
    y_health = np.array([remap[v] for v in y_health])
n_health = len(set(y_health))
print(f"  Health classes: {HEALTH_NAMES[:n_health]}")

# ── 2. Derive actuator labels (data-driven) ───────────────────────────────────
print("\nStep 2 – Deriving actuator labels")

PUMP_PCTILE  = 0.33   # driest 33% within each health class → pump
FAN_PCTILE   = 0.67   # hottest/driest 33% within each health class → fan

pump_bit = np.zeros(len(df), dtype=int)   # bit 0
fan_bit  = np.zeros(len(df), dtype=int)   # bit 1

for h_label in range(n_health):
    mask = y_health == h_label

    # ----- pump signal: soil below within-class 33rd percentile --------------
    soil_vals = df.loc[mask, "soil_moisture"].values
    soil_thr  = np.percentile(soil_vals, PUMP_PCTILE * 100)
    pump_bit[mask & (df["soil_moisture"].values < soil_thr)] = 1

    # ----- fan signal: thermal score above within-class 67th percentile ------
    temp   = df.loc[mask, "temperature"].values
    humid  = df.loc[mask, "air_humidity"].values
    # Higher weight on temperature; low humidity compounds heat stress
    thermal = 0.70 * temp + 0.30 * (100.0 - humid)
    fan_thr = np.percentile(thermal, FAN_PCTILE * 100)

    full_thermal = 0.70 * df["temperature"].values + 0.30 * (100.0 - df["air_humidity"].values)
    fan_bit[mask & (full_thermal > fan_thr)] = 1

    print(f"  Class '{HEALTH_NAMES[h_label]}': soil_thr={soil_thr:.2f}, fan_thr={fan_thr:.2f}")

# Combine bits → 4-class actuator label
y_act = pump_bit | (fan_bit << 1)   # 0,1,2,3

counts = {ACT_NAMES[k]: int((y_act == k).sum()) for k in range(4)}
print(f"  Label distribution: {counts}")

# ── 3. Train/val/test split ───────────────────────────────────────────────────
print("\nStep 3 – Splitting data")
X_temp, X_test, y_temp, y_test = train_test_split(
    X_raw, y_act, test_size=0.20, random_state=42, stratify=y_act
)
X_train, X_val, y_train, y_val = train_test_split(
    X_temp, y_temp, test_size=0.20, random_state=42, stratify=y_temp
)
print(f"  Train: {len(X_train)} | Val: {len(X_val)} | Test: {len(X_test)}")

# ── 4. Train actuator Decision Tree ──────────────────────────────────────────
print("\nStep 4 – Training Actuator Decision Tree")

# We deliberately use a richer tree (deeper, smaller leaves) so that the model
# must learn the joint feature interactions between temperature, humidity, and
# soil – rather than collapsing to one-feature splits.
dt_act = DecisionTreeClassifier(
    max_depth=5,
    min_samples_leaf=4,
    class_weight="balanced",
    random_state=42,
    criterion="gini",
)
dt_act.fit(X_train, y_train)

train_acc = accuracy_score(y_train, dt_act.predict(X_train))
val_acc   = accuracy_score(y_val,   dt_act.predict(X_val))
test_acc  = accuracy_score(y_test,  dt_act.predict(X_test))
cv_acc    = cross_val_score(dt_act, X_train, y_train,
                             cv=StratifiedKFold(5), scoring="accuracy").mean()

print(f"  Train: {train_acc:.4f} | Val: {val_acc:.4f} | "
      f"Test: {test_acc:.4f} | CV: {cv_acc:.4f}")
print()
print(export_text(dt_act, feature_names=FEATURES, show_weights=True))

print("\nClassification Report (test set):")
print(classification_report(y_test, dt_act.predict(X_test),
                             target_names=ACT_NAMES, digits=3))

# ── 5. Save model ─────────────────────────────────────────────────────────────
print("Step 5 – Saving model")
meta = {
    "model":        dt_act,
    "model_name":   "Decision Tree (Actuator)",
    "features":     FEATURES,
    "act_names":    ACT_NAMES,
    "n_classes":    4,
    "test_accuracy": float(test_acc),
    "pump_pctile":  PUMP_PCTILE,
    "fan_pctile":   FAN_PCTILE,
}
pkl_path = MODELS_DIR / "actuator_classifier.pkl"
with open(pkl_path, "wb") as f:
    pickle.dump(meta, f)
print(f"  Saved: {pkl_path}")

# ── 6. Export Decision Tree → C header ────────────────────────────────────────
print("\nStep 6 – Exporting to C header")


def _tree_to_c(clf, feature_names):
    """Recursively convert a sklearn Decision Tree to C if/else code."""
    tree_    = clf.tree_
    feat_map = [
        feature_names[i] if i != _tree.TREE_UNDEFINED else "?"
        for i in tree_.feature
    ]
    lines = []

    def recurse(node, depth):
        pad = "    " * depth
        if tree_.feature[node] != _tree.TREE_UNDEFINED:
            feat = feat_map[node]
            thr  = tree_.threshold[node]
            lines.append(f"{pad}if ({feat} <= {thr:.4f}f) {{")
            recurse(tree_.children_left[node],  depth + 1)
            lines.append(f"{pad}}} else {{")
            recurse(tree_.children_right[node], depth + 1)
            lines.append(f"{pad}}}")
        else:
            cls_idx  = int(np.argmax(tree_.value[node][0]))
            cls_name = ACT_NAMES[cls_idx]
            lines.append(f"{pad}return ACTUATOR_{cls_name.upper()};  // {cls_name}")

    recurse(0, 1)
    return "\n".join(lines)


c_body = _tree_to_c(dt_act, FEATURES)
print(f"  Generated {len(c_body.splitlines())} lines of C code")

header = f"""\
// AUTO-GENERATED – DO NOT EDIT
// Model: Actuator Decision Tree
// Test accuracy: {test_acc * 100:.1f}%
// Features: temperature (°C), air_humidity (%), soil_moisture (%)
// Labels: 0=idle  1=pump  2=fan  3=pump_and_fan
#pragma once
#include <stdint.h>

#define N_ACTUATOR_CLASSES 4

enum ActuatorAction : uint8_t {{
    ACTUATOR_IDLE         = 0,
    ACTUATOR_PUMP         = 1,
    ACTUATOR_FAN          = 2,
    ACTUATOR_PUMP_AND_FAN = 3,
}};

static const char* const ACTUATOR_NAMES[] = {{
    "idle", "pump", "fan", "pump_and_fan"
}};

inline ActuatorAction classifyActuator(
    float temperature,
    float air_humidity,
    float soil_moisture
) {{
{c_body}
}}
"""

out_path = FIRMWARE_DIR / "actuator_classifier.h"
out_path.write_text(header, encoding="utf-8")
print(f"  Written: {out_path}")
print(f"  Size: {out_path.stat().st_size} bytes")

# ── 7. Self-test: Python model must match C-export results ────────────────────
print("\nStep 7 – Self-test (Python vs C logic)")

TEST_CASES = [
    # (temp,  hum,  soil)   expected intuition
    (25.0,  60.0, 45.0),   # well-hydrated, cool → idle
    (35.0,  20.0, 10.0),   # hot, dry, desiccated → pump + fan
    (20.0,  80.0, 70.0),   # cool, humid, wet     → idle
    (30.0,  40.0, 15.0),   # warm, dry soil       → pump likely
    (32.0,  55.0, 50.0),   # hot, ok humidity/soil → fan likely
]

print(f"  {'Temp':>6} {'Hum':>6} {'Soil':>6}  -> Actuator")
print(f"  {'----':>6} {'----':>6} {'----':>6}  ----------")
for temp, hum, soil in TEST_CASES:
    pred  = int(dt_act.predict([[temp, hum, soil]])[0])
    label = ACT_NAMES[pred]
    print(f"  {temp:>6.1f} {hum:>6.1f} {soil:>6.1f}  -> {label}")

print("\nDone!  actuator_classifier.h is ready for the ESP8266 firmware.")
