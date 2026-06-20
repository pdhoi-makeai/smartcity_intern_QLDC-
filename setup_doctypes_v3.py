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
                "permissions": [{"role": "Guest", "read": 1, "write": 1, "create": 1, "delete": 1}]
            })
            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            print(f"Created DocType: {name}")
        else:
            print(f"DocType {name} already exists")
            doc = frappe.get_doc("DocType", name)
            doc.fields = []
            for f in fields:
                doc.append("fields", f)
            doc.permissions = [{"role": "Guest", "read": 1, "write": 1, "create": 1, "delete": 1}]
            doc.save(ignore_permissions=True)
            frappe.db.commit()
            print(f"Updated DocType: {name}")

    module = "Quan Ly Dan Cu"

    # 1. City
    create_doctype("City", module, [
        {"fieldname": "city_name", "fieldtype": "Data", "label": "Tên Thành phố", "reqd": 1, "unique": 1},
        {"fieldname": "total_area", "fieldtype": "Float", "label": "Tổng diện tích (km2)"},
        {"fieldname": "total_population", "fieldtype": "Int", "label": "Tổng dân số"},
        {"fieldname": "geojson_boundary", "fieldtype": "Code", "label": "GeoJSON Boundary"}
    ])

    # 2. District
    create_doctype("District", module, [
        {"fieldname": "district_name", "fieldtype": "Data", "label": "Tên Quận/Huyện", "reqd": 1},
        {"fieldname": "city", "fieldtype": "Link", "label": "Thành phố", "options": "City", "reqd": 1},
        {"fieldname": "geojson_boundary", "fieldtype": "Code", "label": "GeoJSON Boundary"}
    ])

    # 3. Ward
    create_doctype("Ward", module, [
        {"fieldname": "ward_name", "fieldtype": "Data", "label": "Tên Phường/Xã", "reqd": 1},
        {"fieldname": "ward_code", "fieldtype": "Data", "label": "Mã Phường/Xã", "unique": 1},
        {"fieldname": "district", "fieldtype": "Link", "label": "Quận/Huyện", "options": "District", "reqd": 1},
        {"fieldname": "geojson_boundary", "fieldtype": "Code", "label": "GeoJSON Boundary"}
    ])

    # 4. Neighborhood
    create_doctype("Neighborhood", module, [
        {"fieldname": "neighborhood_name", "fieldtype": "Data", "label": "Tên Tổ dân phố", "reqd": 1},
        {"fieldname": "ward", "fieldtype": "Link", "label": "Phường/Xã", "options": "Ward", "reqd": 1},
        {"fieldname": "leader_name", "fieldtype": "Data", "label": "Tổ trưởng"},
        {"fieldname": "geojson_polygon", "fieldtype": "Code", "label": "GeoJSON Polygon"}
    ])

    # 5. Household
    create_doctype("Household", module, [
        {"fieldname": "head_name", "fieldtype": "Data", "label": "Tên Chủ hộ", "reqd": 1},
        {"fieldname": "neighborhood", "fieldtype": "Link", "label": "Tổ dân phố", "options": "Neighborhood", "reqd": 1},
        {"fieldname": "address", "fieldtype": "Data", "label": "Địa chỉ", "reqd": 1},
        {"fieldname": "status", "fieldtype": "Select", "label": "Trạng thái", "options": "Chưa định vị\nĐã định vị", "default": "Chưa định vị"},
        {"fieldname": "latitude", "fieldtype": "Float", "label": "Vĩ độ (Latitude)"},
        {"fieldname": "longitude", "fieldtype": "Float", "label": "Kinh độ (Longitude)"},
        {"fieldname": "household_type", "fieldtype": "Select", "label": "Diện gia đình", "options": "Bình thường\nHộ nghèo\nHộ cận nghèo\nGia đình chính sách", "default": "Bình thường"}
    ])

    # 6. Resident
    create_doctype("Resident", module, [
        {"fieldname": "full_name", "fieldtype": "Data", "label": "Họ và tên", "reqd": 1},
        {"fieldname": "cccd", "fieldtype": "Data", "label": "CCCD/CMND", "unique": 1},
        {"fieldname": "dob", "fieldtype": "Date", "label": "Ngày sinh"},
        {"fieldname": "age", "fieldtype": "Int", "label": "Tuổi"},
        {"fieldname": "gender", "fieldtype": "Select", "label": "Giới tính", "options": "Nam\nNữ\nKhác"},
        {"fieldname": "household", "fieldtype": "Link", "label": "Hộ gia đình", "options": "Household", "reqd": 1},
        {"fieldname": "residency_status", "fieldtype": "Select", "label": "Trạng thái cư trú", "options": "Thường trú\nTạm trú", "default": "Thường trú"},
        {"fieldname": "social_welfare_status", "fieldtype": "Select", "label": "Trạng thái an sinh", "options": "Bình thường\nNgười cao tuổi neo đơn\nNgười khuyết tật", "default": "Bình thường"}
    ])
    
    # Optional: Generate API keys for Administrator just in case Frontend needs it for writing
    admin = frappe.get_doc("User", "Administrator")
    if not admin.api_key:
        api_secret = frappe.generate_hash(length=15)
        admin.api_key = frappe.generate_hash(length=15)
        admin.api_secret = api_secret
        admin.save(ignore_permissions=True)
        frappe.db.commit()
        print(f"Generated Administrator API Key: {admin.api_key} Secret: {api_secret}")
