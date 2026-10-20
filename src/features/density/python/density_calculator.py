#!/usr/bin/env python3
"""
Amenities Density & Spatial Accessibility Calculator
Built using GeoPandas, Shapely, and PyProj.
Calculates trustworthy geodesic/projected spatial area, amenities density (places/km²),
Shannon diversity index, and 15-minute city accessibility score.

Usage:
  python density_calculator.py --input sample_data.json
  python density_calculator.py --geojson isochrone.geojson --places places.json
"""

import sys
import json
import math
from typing import Dict, Any, List

try:
    import geopandas as gpd
    import pandas as pd
    from shapely.geometry import shape, Point, Polygon, MultiPolygon
    from shapely.ops import transform
    import pyproj
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False


def calculate_polygon_area_geopandas(geometry_dict: Dict[str, Any]) -> float:
    """
    Calculates exact projected area in square kilometers (km²) using GeoPandas.
    Reprojects WGS84 (EPSG:4326) to UTM Zone 48N (EPSG:32648) for metric precision in Malaysia/KL.
    """
    if not HAS_GEOPANDAS:
        return calculate_polygon_area_spherical(geometry_dict)

    geom = shape(geometry_dict)
    gdf = gpd.GeoDataFrame([{'geometry': geom}], crs="EPSG:4326")
    # Reproject to UTM Zone 48N (Kuala Lumpur metric projection)
    utm_gdf = gdf.to_crs("EPSG:32648")
    area_m2 = utm_gdf.geometry.area.iloc[0]
    return float(area_m2 / 1_000_000.0)


def calculate_polygon_area_spherical(geometry_dict: Dict[str, Any]) -> float:
    """
    Standard spherical shoelace algorithm (WGS84 authalic sphere R=6371.0088km).
    Used as fallback or standalone pure-Python calculator.
    """
    R = 6371.0088

    def ring_area(coords: List[List[float]]) -> float:
        if len(coords) < 3:
            return 0.0
        total = 0.0
        n = len(coords)
        for i in range(n):
            p1 = coords[i]
            p2 = coords[(i + 1) % n]
            lon1, lat1 = math.radians(p1[0]), math.radians(p1[1])
            lon2, lat2 = math.radians(p2[0]), math.radians(p2[1])
            total += (lon2 - lon1) * (2.0 + math.sin(lat1) + math.sin(lat2))
        return abs(total * (R * R) / 2.0)

    gtype = geometry_dict.get("type", "")
    coords = geometry_dict.get("coordinates", [])

    if gtype == "Polygon":
        outer = ring_area(coords[0])
        holes = sum(ring_area(h) for h in coords[1:])
        return max(0.0, outer - holes)
    elif gtype == "MultiPolygon":
        total = 0.0
        for poly in coords:
            outer = ring_area(poly[0])
            holes = sum(ring_area(h) for h in poly[1:])
            total += max(0.0, outer - holes)
        return total
    return 0.0


def calculate_diversity_index(places: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Shannon-Wiener Diversity Index and Evenness across amenity categories.
    """
    if not places:
        return {"shannon_index": 0.0, "evenness": 0.0, "counts": {}}

    counts = {}
    for p in places:
        cat = p.get("cat", {})
        group = cat.get("groupId") or cat.get("groupName") or p.get("categoryId") or "other"
        counts[group] = counts.get(group, 0) + 1

    total = len(places)
    h_prime = 0.0
    for g, count in counts.items():
        p_i = count / total
        if p_i > 0:
            h_prime -= p_i * math.log(p_i)

    num_groups = len(counts)
    max_h = math.log(num_groups) if num_groups > 1 else 1.0
    evenness = (h_prime / max_h) if num_groups > 1 else 0.0

    return {
        "shannon_index": round(h_prime, 3),
        "evenness": round(min(1.0, max(0.0, evenness)), 3),
        "counts": counts,
    }


def calculate_amenities_density_score(
    isochrone_geometry: Dict[str, Any],
    places: List[Dict[str, Any]],
    travel_minutes: int = 20,
    travel_mode: str = "walking",
) -> Dict[str, Any]:
    """
    Computes comprehensive density & 15-minute city spatial accessibility metrics.
    """
    area_km2 = (
        calculate_polygon_area_geopandas(isochrone_geometry)
        if HAS_GEOPANDAS
        else calculate_polygon_area_spherical(isochrone_geometry)
    )

    total_places = len(places)
    density_per_km2 = round(total_places / area_km2, 1) if area_km2 > 0 else 0.0

    diversity = calculate_diversity_index(places)

    has_groceries = any(p.get("categoryId") in ["grocery", "mall"] for p in places)
    has_food = any((p.get("cat", {}).get("groupId") == "food" or p.get("categoryId") in ["restaurant", "cafe"]) for p in places)
    has_transit = any((p.get("cat", {}).get("groupId") == "transport" or p.get("categoryId") in ["lrt-station", "train-station", "monorail-station", "bus-station"]) for p in places)
    has_education = any((p.get("cat", {}).get("groupId") == "education" or p.get("categoryId") in ["kindergarten", "primary-school", "secondary", "university", "tuition-centre"]) for p in places)
    has_healthcare = any(p.get("categoryId") in ["hospital", "clinic", "pharmacy"] for p in places)
    has_leisure = any((p.get("cat", {}).get("groupId") == "things-to-do" or p.get("categoryId") in ["park", "gym", "art", "library"]) for p in places)

    sustenance_score = (12 if has_groceries else 0) + (8 if has_food else 0)
    transit_score = 20 if has_transit else 0
    education_score = 15 if has_education else 0
    healthcare_score = 15 if has_healthcare else 0
    leisure_score = 15 if has_leisure else 0

    benchmark = 35.0 if travel_mode == "walking" else (15.0 if travel_mode == "cycling" else 5.0)
    density_component = round(min(1.0, density_per_km2 / benchmark) * 15)

    final_score = min(100, max(0, sustenance_score + transit_score + education_score + healthcare_score + leisure_score + density_component))

    if final_score >= 85:
        rating = "Exceptional Urban Accessibility (15-Minute City Tier 1)"
    elif final_score >= 70:
        rating = "High Amenity Density (Tier 2 Urban Hub)"
    elif final_score >= 50:
        rating = "Moderate Amenity Accessibility (Tier 3 Established District)"
    else:
        rating = "Emerging Density Zone (Tier 4)"

    return {
        "score": final_score,
        "rating": rating,
        "area_km2": round(area_km2, 2),
        "density_per_km2": density_per_km2,
        "total_places": total_places,
        "diversity_index": diversity["shannon_index"],
        "evenness": diversity["evenness"],
        "category_counts": diversity["counts"],
        "travel_params": {
            "travel_minutes": travel_minutes,
            "mode": travel_mode,
        },
        "engine": "GeoPandas (EPSG:32648 UTM Zone 48N) & Shapely" if HAS_GEOPANDAS else "Geodesic Shoelace",
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--demo":
        sample_iso = {
            "type": "Polygon",
            "coordinates": [[
                [101.700, 3.135],
                [101.715, 3.135],
                [101.720, 3.148],
                [101.710, 3.155],
                [101.698, 3.145],
                [101.700, 3.135],
            ]],
        }
        sample_places = [
            {"categoryId": "restaurant", "cat": {"groupId": "food"}, "name": "Sample Restaurant"},
            {"categoryId": "lrt-station", "cat": {"groupId": "transport"}, "name": "Sample LRT"},
            {"categoryId": "mall", "cat": {"groupId": "shopping"}, "name": "Sample Mall"},
            {"categoryId": "primary-school", "cat": {"groupId": "education"}, "name": "Sample School"},
            {"categoryId": "clinic", "cat": {"groupId": "services"}, "name": "Sample Clinic"},
            {"categoryId": "park", "cat": {"groupId": "things-to-do"}, "name": "Sample Park"},
        ]
        result = calculate_amenities_density_score(sample_iso, sample_places)
        print(json.dumps(result, indent=2))
    else:
        print("Run with --demo to test calculation, or import as module.")
