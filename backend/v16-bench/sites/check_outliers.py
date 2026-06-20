import sys
sys.path.insert(0, "..")
import frappe

frappe.init(site="smartcity.localhost")
frappe.connect()

def run():
    hc_district = frappe.get_all("District", filters={"district_name": "Hải Châu"})[0]
    wards = frappe.get_all("Ward", filters={"district": hc_district.name}, fields=["name", "ward_name"])
    ward_names = {w.name: w.ward_name for w in wards}
    
    # Get all neighborhoods of these wards
    neighs = frappe.get_all("Neighborhood", filters=[["ward", "in", list(ward_names.keys())]], fields=["name", "neighborhood_name", "ward"])
    neigh_map = {n.name: n for n in neighs}
    
    # Get households with longitude < 108.20
    households = frappe.get_all("Household", filters=[["neighborhood", "in", list(neigh_map.keys())]], fields=["name", "neighborhood", "latitude", "longitude"])
    
    print(f"Total households: {len(households)}")
    outliers = [h for h in households if h.longitude and h.longitude < 108.20]
    print(f"Found {len(outliers)} households with Lng < 108.20:")
    
    ward_counts = {}
    for h in outliers[:30]:
        n = neigh_map.get(h.neighborhood)
        w_name = ward_names.get(n.ward) if n else "Unknown"
        n_name = n.neighborhood_name if n else "Unknown"
        print(f" - HH: {h.name} | Neighborhood: {n_name} ({h.neighborhood}) | Ward: {w_name} | Lat: {h.latitude} | Lng: {h.longitude}")
        
    for h in outliers:
        n = neigh_map.get(h.neighborhood)
        w_name = ward_names.get(n.ward) if n else "Unknown"
        ward_counts[w_name] = ward_counts.get(w_name, 0) + 1
        
    print("\nOutlier counts per ward:")
    for w, count in ward_counts.items():
        print(f" - {w}: {count}")

if __name__ == "__main__":
    run()
