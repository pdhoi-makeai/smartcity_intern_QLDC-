import requests
import time

headers = {
    'User-Agent': 'SmartCityBoundaryImporter/1.0 (contact@smartcity-danang.vn)'
}

missing_wards = ["Bình Hiên", "Bình Thuận", "Phước Ninh", "Hòa Thuận Tây", "Thuận Phước", "Thạch Thang"]

for w in missing_wards:
    queries = [
        f"Phường {w}, Quận Hải Châu, Đà Nẵng",
        f"Phường {w}, Hải Châu, Đà Nẵng",
        f"Phường {w}, Đà Nẵng",
        f"{w}, Hải Châu, Đà Nẵng"
    ]
    
    print(f"\n==================== Searches for {w} ====================")
    for q in queries:
        url = f"https://nominatim.openstreetmap.org/search?q={q}&format=jsonv2&polygon_geojson=1"
        try:
            res = requests.get(url, headers=headers).json()
            time.sleep(1) # respect Nominatim rate limit
            if res:
                print(f"Query: '{q}' -> found {len(res)} results:")
                for r in res[:3]:
                    has_geojson = "geojson" in r and r["geojson"]["type"] in ["Polygon", "MultiPolygon"]
                    print(f"  - Name: {r['display_name']}\n    Type: {r['osm_type']} | ID: {r['osm_id']} | Has GeoJSON Polygon: {has_geojson}")
            else:
                print(f"Query: '{q}' -> No results")
        except Exception as e:
            print(f"Query: '{q}' -> Error: {e}")
