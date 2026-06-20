import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def execute():
    # 1. Thêm trường life_status cho Resident
    custom_fields = {
        "Resident": [
            {
                "fieldname": "life_status",
                "fieldtype": "Select",
                "label": "Tình trạng sống",
                "options": "Còn sống\nĐã qua đời",
                "default": "Còn sống",
                "insert_after": "residency_status"
            }
        ]
    }
    
    create_custom_fields(custom_fields)
    
    # 2. Cập nhật options cho residency_status
    if frappe.db.exists("DocField", {"parent": "Resident", "fieldname": "residency_status"}):
        frappe.db.set_value("DocField", {"parent": "Resident", "fieldname": "residency_status"}, "options", "Thường trú\nTạm trú\nTạm vắng")
    
    frappe.clear_cache(doctype="Resident")
    frappe.db.commit()
    print("Setup Life Events data successfully!")
