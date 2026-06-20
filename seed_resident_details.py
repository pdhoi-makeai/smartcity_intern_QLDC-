import frappe
from datetime import datetime, timedelta
import random

def execute():
    # 1. Cập nhật options cho Custom Field
    custom_field_name = "Resident-social_welfare_status"
    if frappe.db.exists("Custom Field", custom_field_name):
        frappe.db.set_value("Custom Field", custom_field_name, "options", "Bình thường\nNgười cao tuổi neo đơn\nNgười khuyết tật\nThương binh/Liệt sĩ")
        frappe.clear_cache(doctype="Resident")
        print("Updated social_welfare_status options.")
    else:
        print("Custom field Resident-social_welfare_status not found!")

    # Lấy năm hiện tại
    current_year = datetime.now().year

    # 2. Seed dữ liệu DOB và status cho các cư dân
    residents = frappe.get_all("Resident", fields=["name", "age", "social_welfare_status"])
    print(f"Bắt đầu seed dữ liệu cho {len(residents)} cư dân...")

    count = 0
    welfare_options = ["Bình thường", "Người khuyết tật", "Thương binh/Liệt sĩ"]
    
    for r in residents:
        doc = frappe.get_doc("Resident", r.name)
        age = r.age or 0
        birth_year = current_year - age
        
        # Random tháng (1-12) và ngày (1-28)
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        
        dob_str = f"{birth_year}-{month:02d}-{day:02d}"
        doc.dob = dob_str

        # Nếu người già, có thể gán "Người cao tuổi neo đơn"
        if age >= 60 and random.random() < 0.1:
            doc.social_welfare_status = "Người cao tuổi neo đơn"
        # Seed ngẫu nhiên các diện khác
        elif doc.social_welfare_status == "Bình thường" and random.random() < 0.05:
            doc.social_welfare_status = random.choice(welfare_options)

        doc.flags.ignore_mandatory = True
        doc.flags.ignore_validate = True
        doc.flags.ignore_permissions = True
        doc.save()

        count += 1
        if count % 1000 == 0:
            frappe.db.commit()
            print(f"Đã xử lý {count}/{len(residents)}...")

    frappe.db.commit()
    print("Seed dữ liệu thành công!")
