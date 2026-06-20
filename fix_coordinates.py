import frappe
import random
import math

def execute():
    """Re-scatter household coordinates to be more realistic per ward"""
    
    # Approximate center coordinates for each ward in Hai Chau
    ward_centers = {
        "Hải Châu I":       {"lat": 16.0690, "lng": 108.2210, "r": 0.004},
        "Hải Châu II":      {"lat": 16.0650, "lng": 108.2240, "r": 0.004},
        "Thạch Thang":      {"lat": 16.0710, "lng": 108.2140, "r": 0.003},
        "Thuận Phước":      {"lat": 16.0800, "lng": 108.2130, "r": 0.005},
        "Hòa Thuận Tây":    {"lat": 16.0580, "lng": 108.2050, "r": 0.004},
        "Hòa Thuận Đông":   {"lat": 16.0620, "lng": 108.2120, "r": 0.004},
        "Nam Dương":        {"lat": 16.0670, "lng": 108.2170, "r": 0.003},
        "Phước Ninh":       {"lat": 16.0630, "lng": 108.2180, "r": 0.003},
        "Bình Thuận":       {"lat": 16.0560, "lng": 108.2150, "r": 0.003},
        "Bình Hiên":        {"lat": 16.0600, "lng": 108.2200, "r": 0.003},
        "Hòa Cường Bắc":   {"lat": 16.0480, "lng": 108.2100, "r": 0.005},
        "Hòa Cường Nam":    {"lat": 16.0400, "lng": 108.2080, "r": 0.005},
        "Thanh Bình":       {"lat": 16.0720, "lng": 108.2080, "r": 0.003},
    }
    
    # Get all wards in Hai Chau
    hai_chau = frappe.get_doc("District", {"district_name": "Hải Châu"})
    hc_wards = frappe.get_all("Ward", filters={"district": hai_chau.name}, fields=["name", "ward_name"])
    
    updated = 0
    for w in hc_wards:
        center = ward_centers.get(w.ward_name)
        if not center:
            continue
        
        # Get all neighborhoods in this ward
        neighborhoods = frappe.get_all("Neighborhood", filters={"ward": w.name}, fields=["name"])
        
        for nb in neighborhoods:
            # Get all households in this neighborhood
            households = frappe.get_all("Household", filters={"neighborhood": nb.name}, fields=["name"])
            
            for hh in households:
                # Generate scattered coordinates with gaussian distribution around ward center
                angle = random.uniform(0, 2 * math.pi)
                distance = random.gauss(0, center["r"] * 0.6)  # gaussian spread
                lat = center["lat"] + distance * math.cos(angle) + random.uniform(-0.001, 0.001)
                lng = center["lng"] + distance * math.sin(angle) + random.uniform(-0.001, 0.001)
                
                frappe.db.set_value("Household", hh.name, {
                    "latitude": round(lat, 6),
                    "longitude": round(lng, 6),
                    "status": "Đã định vị"
                })
                updated += 1
    
    frappe.db.commit()
    print(f"Updated {updated} household coordinates with scattered distribution!")
