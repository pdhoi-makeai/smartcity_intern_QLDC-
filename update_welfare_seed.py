import frappe
import random

def execute():
    # Fetch all households
    households = frappe.get_all("Household", fields=["name", "household_type"])
    
    # Update households
    household_types = ["Bình thường", "Bình thường", "Bình thường", "Bình thường", "Hộ nghèo", "Hộ cận nghèo", "Gia đình chính sách"]
    
    print(f"Updating {len(households)} households...")
    for hh in households:
        new_type = random.choice(household_types)
        frappe.db.set_value("Household", hh.name, "household_type", new_type)
        
    # Fetch all residents
    residents = frappe.get_all("Resident", fields=["name", "age", "social_welfare_status"])
    
    # Update residents
    print(f"Updating {len(residents)} residents...")
    for res in residents:
        welfare = "Bình thường"
        if res.age and res.age > 70:
            if random.random() > 0.7:
                welfare = "Người cao tuổi neo đơn"
        elif random.random() > 0.98:
            welfare = "Người khuyết tật"
            
        frappe.db.set_value("Resident", res.name, "social_welfare_status", welfare)
        
    frappe.db.commit()
    print("Successfully updated welfare seed data!")
