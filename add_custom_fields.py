import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def execute():
    custom_fields = {
        "Household": [
            {"fieldname": "household_type", "fieldtype": "Select", "label": "Diện gia đình", "options": "Bình thường\nHộ nghèo\nHộ cận nghèo\nGia đình chính sách", "default": "Bình thường", "insert_after": "longitude"}
        ],
        "Resident": [
            {"fieldname": "social_welfare_status", "fieldtype": "Select", "label": "Trạng thái an sinh", "options": "Bình thường\nNgười cao tuổi neo đơn\nNgười khuyết tật", "default": "Bình thường", "insert_after": "residency_status"}
        ]
    }
    
    create_custom_fields(custom_fields)
    frappe.db.commit()
    print("Successfully added custom fields!")
