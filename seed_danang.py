import frappe
import random

def execute():
    # 1. Update District and Ward DocType with new fields
    def add_fields(doctype):
        doc = frappe.get_doc("DocType", doctype)
        existing_fields = [f.fieldname for f in doc.fields]
        new_fields = [
            {"fieldname": "administrative_code", "fieldtype": "Data", "label": "Mã ĐVHC"},
            {"fieldname": "area", "fieldtype": "Float", "label": "Diện tích (km2)"},
            {"fieldname": "population", "fieldtype": "Int", "label": "Dân số (người)"},
            {"fieldname": "density", "fieldtype": "Float", "label": "Mật độ (người/km2)"},
            {"fieldname": "headquarters", "fieldtype": "Data", "label": "Trụ sở"},
            {"fieldname": "merged_with", "fieldtype": "Data", "label": "Sáp nhập"}
        ]
        added = False
        for nf in new_fields:
            if nf["fieldname"] not in existing_fields:
                doc.append("fields", nf)
                added = True
        if added:
            doc.save(ignore_permissions=True)
            print(f"Updated {doctype} DocType.")

    add_fields("District")
    add_fields("Ward")
    frappe.db.commit()

    # 2. Insert Da Nang City
    city_name = "TP. Đà Nẵng"
    if not frappe.db.exists("City", {"city_name": city_name}):
        city = frappe.get_doc({
            "doctype": "City",
            "city_name": city_name,
            "total_area": 1285.4,
            "total_population": 1220000
        })
        city.insert(ignore_permissions=True)
    city_doc = frappe.get_doc("City", {"city_name": city_name})

    # 3. Districts Data
    districts_data = {
        "Hải Châu": {"code": "20261", "area": 21.35, "pop": 204000},
        "Thanh Khê": {"code": "20262", "area": 9.28, "pop": 195000},
        "Sơn Trà": {"code": "20263", "area": 56.0, "pop": 86890},
        "Ngũ Hành Sơn": {"code": "20264", "area": 40.0, "pop": 115000},
        "Liên Chiểu": {"code": "20265", "area": 75.0, "pop": 196000},
        "Cẩm Lệ": {"code": "20266", "area": 33.76, "pop": 143000},
        "Hòa Vang": {"code": "20267", "area": 707.0, "pop": 201000},
        "Hoàng Sa": {"code": "20268", "area": 305.0, "pop": 0}
    }

    wards_data = {
        "Hải Châu": ["Hải Châu I", "Hải Châu II", "Thạch Thang", "Thuận Phước", "Hòa Thuận Tây", "Hòa Thuận Đông", "Nam Dương", "Phước Ninh", "Bình Thuận", "Bình Hiên", "Hòa Cường Bắc", "Hòa Cường Nam", "Thanh Bình"],
        "Thanh Khê": ["Vĩnh Trung", "Tân Chính", "Thạc Gián", "Chính Gián", "Tam Thuận", "Xuân Hà", "An Khê", "Hòa Khê", "Thanh Khê Đông", "Thanh Khê Tây"],
        "Sơn Trà": ["Thọ Quang", "Nại Hiên Đông", "Mân Thái", "An Hải Bắc", "An Hải Tây", "An Hải Đông", "Phước Mỹ"],
        "Ngũ Hành Sơn": ["Mỹ An", "Khuê Mỹ", "Hòa Hải", "Hòa Quý"],
        "Liên Chiểu": ["Hòa Hiệp Bắc", "Hòa Hiệp Nam", "Hòa Khánh Bắc", "Hòa Khánh Nam", "Hòa Minh"],
        "Cẩm Lệ": ["Khuê Trung", "Hòa Thọ Đông", "Hòa Thọ Tây", "Hòa Phát", "Hòa An", "Hòa Xuân"],
        "Hòa Vang": ["Hòa Bắc", "Hòa Liên", "Hòa Ninh", "Hòa Sơn", "Hòa Nhơn", "Hòa Phú", "Hòa Phong", "Hòa Châu", "Hòa Tiến", "Hòa Khương", "Hòa Phước"],
        "Hoàng Sa": []
    }

    # Ho Ngan list to generate names
    ho_list = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"]
    dem_list = ["Văn", "Thị", "Hoàng", "Minh", "Thanh", "Ngọc", "Xuân", "Thu", "Hải", "Đức", "Trọng", "Quốc", "Gia", "Thành", "Bảo"]
    ten_list = ["An", "Anh", "Bình", "Cường", "Dũng", "Hoa", "Lan", "Nhung", "Phong", "Phúc", "Phương", "Quang", "Sơn", "Tâm", "Thảo", "Trang", "Tuấn", "Vinh", "Yến", "Đạt", "Hùng", "Huy", "Nam"]

    print("Inserting Districts and Wards...")
    for d_name, d_info in districts_data.items():
        if not frappe.db.exists("District", {"district_name": d_name, "city": city_doc.name}):
            dist = frappe.get_doc({
                "doctype": "District",
                "district_name": d_name,
                "city": city_doc.name,
                "administrative_code": d_info["code"],
                "area": d_info["area"],
                "population": d_info["pop"],
                "density": round(d_info["pop"] / d_info["area"], 2) if d_info["area"] else 0,
                "headquarters": "đang cập nhật"
            })
            dist.insert(ignore_permissions=True)
        dist_doc = frappe.get_doc("District", {"district_name": d_name, "city": city_doc.name})

        # Insert Wards for this District
        for w_name in wards_data[d_name]:
            if not frappe.db.exists("Ward", {"ward_name": w_name, "district": dist_doc.name}):
                ward = frappe.get_doc({
                    "doctype": "Ward",
                    "ward_name": w_name,
                    "district": dist_doc.name,
                    "administrative_code": f"{d_info['code']}{random.randint(10, 99)}",
                    "area": round(random.uniform(1.0, 5.0), 2),
                    "population": random.randint(5000, 20000),
                    "headquarters": "đang cập nhật"
                })
                ward.density = round(ward.population / ward.area, 2)
                ward.insert(ignore_permissions=True)

    frappe.db.commit()
    print("Districts and Wards setup complete.")

    # 4. Generate massive data for Hai Chau
    print("Generating Neighborhoods, Households and Residents for Hải Châu (this will take a while)...")
    hai_chau_doc = frappe.get_doc("District", {"district_name": "Hải Châu"})
    hc_wards = frappe.get_all("Ward", filters={"district": hai_chau_doc.name})
    
    total_residents = 0
    cccd_counter = 48000000000  # Fake CCCD starting point for Da Nang
    phone_counter = 900000000
    
    # Disable tracking temporarily to speed up massive insert
    frappe.flags.in_import = True 

    for ward_ref in hc_wards:
        w_doc = frappe.get_doc("Ward", ward_ref.name)
        num_neighborhoods = random.randint(20, 30)
        
        for n in range(1, num_neighborhoods + 1):
            n_name = f"Tổ dân phố {n} - {w_doc.ward_name}"
            n_doc = frappe.get_doc({
                "doctype": "Neighborhood",
                "neighborhood_name": n_name,
                "ward": w_doc.name,
                "leader_name": f"{random.choice(ho_list)} {random.choice(dem_list)} {random.choice(ten_list)}"
            }).insert(ignore_permissions=True)

            # 10 Households per Neighborhood
            for h in range(10):
                lat = round(random.uniform(16.03, 16.08), 6) # Hai Chau latitude approx
                lng = round(random.uniform(108.20, 108.23), 6) # Hai Chau longitude approx
                head_name = f"{random.choice(ho_list)} {random.choice(dem_list)} {random.choice(ten_list)}"
                
                hh_doc = frappe.get_doc({
                    "doctype": "Household",
                    "head_name": head_name,
                    "neighborhood": n_doc.name,
                    "address": f"Số {random.randint(1, 200)} Phường {w_doc.ward_name}",
                    "status": "Đã định vị",
                    "latitude": lat,
                    "longitude": lng
                }).insert(ignore_permissions=True)

                # 2-5 Residents per Household
                num_res = random.randint(2, 5)
                for r in range(num_res):
                    r_name = head_name if r == 0 else f"{random.choice(ho_list)} {random.choice(dem_list)} {random.choice(ten_list)}"
                    r_age = random.randint(2, 80)
                    frappe.get_doc({
                        "doctype": "Resident",
                        "full_name": r_name,
                        "cccd": str(cccd_counter),
                        "age": r_age,
                        "gender": random.choice(["Nam", "Nữ"]),
                        "household": hh_doc.name,
                        "residency_status": "Thường trú"
                    }).insert(ignore_permissions=True)
                    cccd_counter += 1
                    total_residents += 1
        
        frappe.db.commit()
        print(f"Generated data for Ward: {w_doc.ward_name}")

    frappe.flags.in_import = False
    print(f"Data Generation Complete! Total Residents inserted for Hải Châu: {total_residents}")
