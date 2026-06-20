import frappe
import random
import math

def execute():
    ward_name = "Hải Châu I"
    ward_center = {"lat": 16.0690, "lng": 108.2210, "r": 0.004}
    
    # 1. Fetch the Ward
    ward_docs = frappe.get_all("Ward", filters={"ward_name": ward_name})
    if not ward_docs:
        print(f"Ward {ward_name} not found!")
        return
    ward = ward_docs[0]
    
    # 2. Fetch Neighborhoods
    neighborhoods = frappe.get_all("Neighborhood", filters={"ward": ward.name})
    if not neighborhoods:
        print(f"No neighborhoods found in {ward_name}")
        return
    
    num_n = len(neighborhoods)
    print(f"Found {num_n} neighborhoods in {ward_name}")
    
    # 3. Calculate grid size for centers
    cols = math.ceil(math.sqrt(num_n))
    rows = math.ceil(num_n / cols)
    
    lat_step = (ward_center["r"] * 2) / rows
    lng_step = (ward_center["r"] * 2) / cols
    
    start_lat = ward_center["lat"] - ward_center["r"] + (lat_step / 2)
    start_lng = ward_center["lng"] - ward_center["r"] + (lng_step / 2)
    
    updated_households = 0
    
    for idx, nb in enumerate(neighborhoods):
        # Determine center for this neighborhood
        r = idx // cols
        c = idx % cols
        
        n_lat = start_lat + (r * lat_step)
        n_lng = start_lng + (c * lng_step)
        
        # Max radius for household scatter to avoid overlap
        n_radius = min(lat_step, lng_step) * 0.4
        
        # Fetch households in this neighborhood
        households = frappe.get_all("Household", filters={"neighborhood": nb.name})
        
        for hh in households:
            # Scatter tightly around neighborhood center
            angle = random.uniform(0, 2 * math.pi)
            distance = random.uniform(0, n_radius)
            
            hh_lat = n_lat + distance * math.cos(angle)
            hh_lng = n_lng + distance * math.sin(angle)
            
            frappe.db.set_value("Household", hh.name, {
                "latitude": round(hh_lat, 6),
                "longitude": round(hh_lng, 6),
                "status": "Đã định vị"
            })
            updated_households += 1
            
    frappe.db.commit()
    print(f"Successfully updated coordinates for {updated_households} households in {num_n} neighborhoods to avoid overlaps.")
