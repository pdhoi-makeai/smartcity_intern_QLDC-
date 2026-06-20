import frappe

def execute():
    def create_doctype(name, module, fields, custom=1):
        if not frappe.db.exists("DocType", name):
            doc = frappe.get_doc({
                "doctype": "DocType",
                "name": name,
                "module": module,
                "custom": custom,
                "autoname": "format:{#}",
                "fields": fields,
                "permissions": [{"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1}]
            })
            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            print(f"Created DocType: {name}")
        else:
            print(f"DocType {name} already exists")

    module = "Ha Tang Do Thi"

    # Smart City Ward
    create_doctype("Smart City Ward", module, [
        {"fieldname": "ward_name", "fieldtype": "Data", "label": "Ward Name", "reqd": 1},
        {"fieldname": "district", "fieldtype": "Data", "label": "District"},
        {"fieldname": "latitude_center", "fieldtype": "Float", "label": "Latitude Center"},
        {"fieldname": "longitude_center", "fieldtype": "Float", "label": "Longitude Center"},
        {"fieldname": "geojson_boundary", "fieldtype": "Code", "label": "GeoJSON Boundary"}
    ])

    # Smart City Asset
    create_doctype("Smart City Asset", module, [
        {"fieldname": "asset_name", "fieldtype": "Data", "label": "Asset Name", "reqd": 1},
        {"fieldname": "asset_type", "fieldtype": "Select", "label": "Asset Type", "options": "Lighting\nCamera\nSensor\nOther"},
        {"fieldname": "ward", "fieldtype": "Link", "label": "Ward", "options": "Smart City Ward"},
        {"fieldname": "status", "fieldtype": "Select", "label": "Status", "options": "Good\nMaintenance\nBroken"},
        {"fieldname": "latitude", "fieldtype": "Float", "label": "Latitude"},
        {"fieldname": "longitude", "fieldtype": "Float", "label": "Longitude"}
    ])

    # Smart City Incident
    create_doctype("Smart City Incident", module, [
        {"fieldname": "asset", "fieldtype": "Link", "label": "Asset", "options": "Smart City Asset", "reqd": 1},
        {"fieldname": "image", "fieldtype": "Attach Image", "label": "Image"},
        {"fieldname": "description", "fieldtype": "Text Editor", "label": "Description"},
        {"fieldname": "ai_is_broken", "fieldtype": "Check", "label": "AI Is Broken"},
        {"fieldname": "ai_reason", "fieldtype": "Small Text", "label": "AI Reason"}
    ])

    # Smart City Household
    create_doctype("Smart City Household", module, [
        {"fieldname": "household_head", "fieldtype": "Data", "label": "Household Head", "reqd": 1},
        {"fieldname": "ward", "fieldtype": "Link", "label": "Ward", "options": "Smart City Ward"},
        {"fieldname": "latitude", "fieldtype": "Float", "label": "Latitude"},
        {"fieldname": "longitude", "fieldtype": "Float", "label": "Longitude"},
        {"fieldname": "electricity_kwh", "fieldtype": "Float", "label": "Electricity (kWh)"},
        {"fieldname": "water_m3", "fieldtype": "Float", "label": "Water (m3)"}
    ])
