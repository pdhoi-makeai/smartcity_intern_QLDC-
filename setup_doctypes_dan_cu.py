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

    module = "Quan Ly Dan Cu"

    # Quan Ly Khu Dan Cu (Ward)
    create_doctype("Quan Ly Khu Dan Cu", module, [
        {"fieldname": "ward_name", "fieldtype": "Data", "label": "Tên Khu dân cư/Tổ dân phố", "reqd": 1},
        {"fieldname": "district", "fieldtype": "Data", "label": "Quận/Huyện"},
        {"fieldname": "ward_head", "fieldtype": "Data", "label": "Tổ trưởng"}
    ])

    # Quan Ly Ho Gia Dinh (Household)
    create_doctype("Quan Ly Ho Gia Dinh", module, [
        {"fieldname": "household_id", "fieldtype": "Data", "label": "Mã Hộ khẩu", "reqd": 1, "unique": 1},
        {"fieldname": "address", "fieldtype": "Data", "label": "Địa chỉ thường trú", "reqd": 1},
        {"fieldname": "ward", "fieldtype": "Link", "label": "Khu dân cư", "options": "Quan Ly Khu Dan Cu"},
        {"fieldname": "household_head_name", "fieldtype": "Data", "label": "Tên Chủ hộ"}
    ])

    # Quan Ly Cu Dan (Resident)
    create_doctype("Quan Ly Cu Dan", module, [
        {"fieldname": "full_name", "fieldtype": "Data", "label": "Họ và tên", "reqd": 1},
        {"fieldname": "identity_card", "fieldtype": "Data", "label": "CCCD/CMND", "reqd": 1, "unique": 1},
        {"fieldname": "dob", "fieldtype": "Date", "label": "Ngày sinh"},
        {"fieldname": "gender", "fieldtype": "Select", "label": "Giới tính", "options": "Nam\nNữ\nKhác"},
        {"fieldname": "phone", "fieldtype": "Data", "label": "Số điện thoại"},
        {"fieldname": "household", "fieldtype": "Link", "label": "Thuộc Hộ gia đình", "options": "Quan Ly Ho Gia Dinh"},
        {"fieldname": "relation_to_head", "fieldtype": "Select", "label": "Quan hệ với chủ hộ", "options": "Chủ hộ\nVợ/Chồng\nCon\nBố/Mẹ\nKhác"},
        {"fieldname": "job", "fieldtype": "Data", "label": "Nghề nghiệp"}
    ])

    # Tam Tru Tam Vang (Temporary Residence)
    create_doctype("Tam Tru Tam Vang", module, [
        {"fieldname": "resident", "fieldtype": "Link", "label": "Cư dân", "options": "Quan Ly Cu Dan"},
        {"fieldname": "type", "fieldtype": "Select", "label": "Loại khai báo", "options": "Tạm trú\nTạm vắng"},
        {"fieldname": "from_date", "fieldtype": "Date", "label": "Từ ngày", "reqd": 1},
        {"fieldname": "to_date", "fieldtype": "Date", "label": "Đến ngày"},
        {"fieldname": "reason", "fieldtype": "Small Text", "label": "Lý do"},
        {"fieldname": "temporary_address", "fieldtype": "Data", "label": "Địa chỉ tạm trú/đến"}
    ])
