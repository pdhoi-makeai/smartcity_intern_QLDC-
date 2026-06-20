import sys
sys.path.insert(0, "..")
import frappe

frappe.init(site="smartcity.localhost")
frappe.connect()

def run():
    w26 = frappe.get_value("Ward", "26", "geojson_boundary")
    print("Ward 26 (Thanh Bình) GeoJSON:")
    print(w26)
    
    w25 = frappe.get_value("Ward", "25", "geojson_boundary")
    print("\nWard 25 (Hòa Cường Nam) GeoJSON:")
    print(w25)
    
    w14 = frappe.get_value("Ward", "14", "geojson_boundary")
    print("\nWard 14 (Hải Châu I) GeoJSON:")
    print(w14)

if __name__ == "__main__":
    run()
