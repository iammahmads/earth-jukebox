#!/usr/bin/env python3
"""
NASA POWER API Fetch Script
Fetches NASA POWER time series data for Earth Jukebox stories.
Caches raw responses in scripts/raw/ and generates standardized data/*.json
"""

import json
import os
import sys
from pathlib import Path
import requests

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "scripts" / "raw"
DATA_DIR = BASE_DIR / "data"

RAW_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

POWER_DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"

STORIES_CONFIG = [
    {
        "story_id": "story-1-seasonal",
        "title": "Seasonal Rhythms: Mediterranean Annual Cycle",
        "dataset": "NASA POWER T2M (2-Meter Air Temperature)",
        "source": "NASA POWER",
        "units": "°C",
        "endpoint": "monthly",
        "parameter": "T2M",
        "latitude": 44.5,
        "longitude": 11.3,
        "start": "2018",
        "end": "2023",
        "threshold": None,
        "area": {
            "name": "Northern Mediterranean (Bologna, Italy)",
            "bbox": [10.0, 43.5, 12.5, 45.5]
        },
        "description": "Witness the natural seasonal heartbeat of Earth. Notice how the temperature reliably peaks each July/August and dips each January, forming a repeating melodic wave."
    },
    {
        "story_id": "story-2-trend",
        "title": "Decadal Warming: Twenty Years of Climate Drift",
        "dataset": "NASA POWER T2M Annual/Monthly Trends",
        "source": "NASA POWER",
        "units": "°C",
        "endpoint": "monthly",
        "parameter": "T2M",
        "latitude": 35.68,
        "longitude": 139.76,
        "start": "2000",
        "end": "2023",
        "threshold": None,
        "area": {
            "name": "Tokyo & Kanto Basin, Japan",
            "bbox": [138.5, 34.8, 140.8, 36.6]
        },
        "description": "A 24-year continuous record tracking subtle but persistent climatic drift. Listen as each decade's baseline gently climbs to higher pitches."
    },
    {
        "story_id": "story-3-event",
        "title": "Sudden Event: 2021 Pacific Northwest Heat Dome",
        "dataset": "NASA POWER T2M_MAX (Maximum Daily Air Temperature)",
        "source": "NASA POWER",
        "units": "°C",
        "endpoint": "daily",
        "parameter": "T2M_MAX",
        "latitude": 49.5,
        "longitude": -120.5,
        "start": "20210501",
        "end": "20210831",
        "threshold": 38.0,
        "threshold_date": "2021-06-25",
        "area": {
            "name": "Pacific Northwest / British Columbia Boundary",
            "bbox": [-124.5, 47.0, -118.0, 51.5]
        },
        "description": "A calm late-spring baseline is violently shattered in late June 2021 as a catastrophic heat dome settles over the Pacific Northwest. An alert marker chimes as temperatures break 38°C (100°F) and soar toward 45°C+."
    }
]

def fetch_monthly_story(conf):
    sid = conf["story_id"]
    raw_file = RAW_DIR / f"{sid}_raw.json"
    
    if raw_file.exists():
        print(f"[{sid}] Using cached response: {raw_file}")
        with open(raw_file, "r", encoding="utf-8") as f:
            raw = json.load(f)
    else:
        print(f"[{sid}] Fetching from NASA POWER monthly API...")
        params = {
            "parameters": conf["parameter"],
            "community": "RE",
            "longitude": conf["longitude"],
            "latitude": conf["latitude"],
            "start": conf["start"],
            "end": conf["end"],
            "format": "JSON"
        }
        res = requests.get(POWER_MONTHLY_URL, params=params, timeout=30)
        res.raise_for_status()
        raw = res.json()
        with open(raw_file, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2)
        print(f"[{sid}] Cached raw data to {raw_file}")

    param_dict = raw["properties"]["parameter"][conf["parameter"]]
    frames = []
    
    for k, v in sorted(param_dict.items()):
        if k.endswith("13"):  # NASA POWER 13 represents the annual average
            continue
        if v == -999.0 or v is None:
            continue
        year = k[:4]
        month = k[4:6]
        date_str = f"{year}-{month}-15"
        # spread approximation based on monthly diurnal temperature variability
        spread = round(abs(v * 0.15), 2)
        frames.append({
            "date": date_str,
            "value": round(float(v), 2),
            "spread": spread
        })

    return build_standard_json(conf, frames)

def fetch_daily_story(conf):
    sid = conf["story_id"]
    raw_file = RAW_DIR / f"{sid}_raw.json"
    
    if raw_file.exists():
        print(f"[{sid}] Using cached response: {raw_file}")
        with open(raw_file, "r", encoding="utf-8") as f:
            raw = json.load(f)
    else:
        print(f"[{sid}] Fetching from NASA POWER daily API...")
        params = {
            "parameters": conf["parameter"],
            "community": "RE",
            "longitude": conf["longitude"],
            "latitude": conf["latitude"],
            "start": conf["start"],
            "end": conf["end"],
            "format": "JSON"
        }
        res = requests.get(POWER_DAILY_URL, params=params, timeout=30)
        res.raise_for_status()
        raw = res.json()
        with open(raw_file, "w", encoding="utf-8") as f:
            json.dump(raw, f, indent=2)
        print(f"[{sid}] Cached raw data to {raw_file}")

    param_dict = raw["properties"]["parameter"][conf["parameter"]]
    frames = []
    
    for k, v in sorted(param_dict.items()):
        if v == -999.0 or v is None:
            continue
        year = k[:4]
        month = k[4:6]
        day = k[6:8]
        date_str = f"{year}-{month}-{day}"
        # spread value based on local variance
        spread = round(abs(v * 0.12), 2)
        frames.append({
            "date": date_str,
            "value": round(float(v), 2),
            "spread": spread
        })

    return build_standard_json(conf, frames)

def build_standard_json(conf, frames):
    values = [f["value"] for f in frames]
    min_val = min(values) if values else 0.0
    max_val = max(values) if values else 100.0
    
    data_obj = {
        "story_id": conf["story_id"],
        "title": conf["title"],
        "dataset": conf["dataset"],
        "source": conf["source"],
        "units": conf["units"],
        "area": conf["area"],
        "min": min_val,
        "max": max_val,
        "threshold": conf.get("threshold"),
        "threshold_date": conf.get("threshold_date"),
        "description": conf.get("description", ""),
        "frames": frames
    }
    
    out_file = DATA_DIR / f"{conf['story_id']}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data_obj, f, indent=2)
        
    print(f"[{conf['story_id']}] Saved {len(frames)} frames ({frames[0]['date']} to {frames[-1]['date']}) -> {out_file}")
    print(f"    Min: {min_val} {conf['units']} | Max: {max_val} {conf['units']} | Threshold: {conf.get('threshold')}")
    return data_obj

def main():
    print("=== Fetching NASA Data for Earth Jukebox ===")
    for conf in STORIES_CONFIG:
        if conf["endpoint"] == "monthly":
            fetch_monthly_story(conf)
        else:
            fetch_daily_story(conf)
    print("=== Data preparation complete ===")

if __name__ == "__main__":
    main()
