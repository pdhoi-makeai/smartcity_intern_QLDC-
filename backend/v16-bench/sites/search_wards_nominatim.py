import requests
import json
import time

headers = {
    'User-Agent': 'SmartCityBoundaryImporter/1.0 (contact@smartcity-danang.vn)'
}

wards = [
    "Thanh Bình", "Hòa Cường Nam", "Hòa Cường Bắc", "Bình Hiên", "Bình Thuận",
    "Phước Ninh", "Nam Dương", "Hòa Thuận Đông", "Hòa Thuận Tây", "Thuận Phước",
    "Thạch Thang", "Hải Châu II", "Hải Châu I"
]

def run():
    for w in wards:
        # Try a few query variations
        queries = [
            f"Phường {w}, Quận Hải Châu, Đà Nẵng",
            f"Phường {w}, Đà Nẵng",
            f"{w}, Hải Châu, Đà Nẵng"
        ]
        found = False
        print(f"\nSearching for {w}...")
        for q in queries:
            url = f"https://nominatim.openstreetmap.org/search?q={q}&format=jsonv2&polygon_geojson=1"
            try:
                res = requests.get(url, headers=headers).json()
                time.sleep(1)
                for r in res:
                    osm_type = r.get("osm_type")
                    osm_id = r.get("osm_id")
                    display_name = r.get("display_name")
                    geojson = r.get("geojson", {})
                    g_type = geojson.get("type")
                    
                    # We are looking for administrative boundary (usually relation)
                    # or at least a Polygon/MultiPolygon
                    if g_type in ["Polygon", "MultiPolygon"]:
                        print(f"  MATCH: Query '{q}'")
                        print(f"    Name: {display_name}")
                        print(f"    OSM Type: {osm_type} | ID: {osm_id}")
                        print(f"    GeoJSON Type: {g_type}")
                        coords = geojson.get("coordinates", [])
                        flat = []
                        def flatten(l):
                            for el in l:
                                if isinstance(el, list) and len(el) == 2 and isinstance(el[0], (int, float)):
                                    flat.append(el)
                                elif isinstance(el, list):
                                    flatten(el)
                        flatten(coords)
                        if flat:
                            lngs = [c[0] for c in flat]
                            lats = [c[1] for c in flat]
                            lng_diff = max(lngs) - min(lngs)
                            lat_diff = max(lats) - min(lats)
                            print(f"    Lng diff: {lng_diff:.6f} | Lat diff: {lat_diff:.6f}")
                            if lng_diff > 0.005 and lat_diff > 0.005:
                                print("    => Looks like a REAL ward boundary!")
                                found = True
                                break
                            else:
                                print("    => Too small, probably a building or POI.")
                if found:
                    break
            except Exception as e:
                print(f"  Error querying '{q}': {e}")
        if not found:
            print(f"  => No real boundary found for {w}")

if __name__ == "__main__":
    run()
