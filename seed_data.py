import frappe

def execute():
    # 1. City
    city_name = "Thành phố Hồ Chí Minh"
    if not frappe.db.exists("City", {"city_name": city_name}):
        city = frappe.get_doc({
            "doctype": "City",
            "city_name": city_name,
            "total_area": 2061,
            "total_population": 9000000
        })
        city.insert(ignore_permissions=True)
        print(f"Inserted City: {city_name}")
    city_doc = frappe.get_doc("City", {"city_name": city_name})
    
    # 2. District
    district_name = "Quận 1"
    if not frappe.db.exists("District", {"district_name": district_name}):
        district = frappe.get_doc({
            "doctype": "District",
            "district_name": district_name,
            "city": city_doc.name
        })
        district.insert(ignore_permissions=True)
        print(f"Inserted District: {district_name}")
    district_doc = frappe.get_doc("District", {"district_name": district_name})

    # 3. Ward
    ward_name = "Phường Bến Nghé"
    if not frappe.db.exists("Ward", {"ward_name": ward_name}):
        ward = frappe.get_doc({
            "doctype": "Ward",
            "ward_name": ward_name,
            "ward_code": "BN01",
            "district": district_doc.name
        })
        ward.insert(ignore_permissions=True)
        print(f"Inserted Ward: {ward_name}")
    ward_doc = frappe.get_doc("Ward", {"ward_name": ward_name})

    # 4. Neighborhood
    neighborhood_name = "Tổ dân phố 1 - Bến Nghé"
    if not frappe.db.exists("Neighborhood", {"neighborhood_name": neighborhood_name}):
        neighborhood = frappe.get_doc({
            "doctype": "Neighborhood",
            "neighborhood_name": neighborhood_name,
            "ward": ward_doc.name,
            "leader_name": "Nguyễn Văn Trưởng"
        })
        neighborhood.insert(ignore_permissions=True)
        print(f"Inserted Neighborhood: {neighborhood_name}")
    neighborhood_doc = frappe.get_doc("Neighborhood", {"neighborhood_name": neighborhood_name})

    # 5. Households
    households = [
        {"head_name": "Nguyễn Văn A", "address": "1 Lê Duẩn", "lat": 10.7811, "lng": 106.6991},
        {"head_name": "Trần Thị B", "address": "5 Tôn Đức Thắng", "lat": 10.7766, "lng": 106.7056},
        {"head_name": "Lê Hoàng C", "address": "15 Nguyễn Du", "lat": 10.7794, "lng": 106.6974}
    ]
    
    household_docs = []
    for h in households:
        if not frappe.db.exists("Household", {"head_name": h["head_name"]}):
            hh = frappe.get_doc({
                "doctype": "Household",
                "head_name": h["head_name"],
                "neighborhood": neighborhood_doc.name,
                "address": h["address"],
                "status": "Đã định vị",
                "latitude": h["lat"],
                "longitude": h["lng"]
            })
            hh.insert(ignore_permissions=True)
            print(f"Inserted Household: {h['head_name']}")
            household_docs.append(hh)
        else:
            household_docs.append(frappe.get_doc("Household", {"head_name": h["head_name"]}))

    # 6. Residents
    residents = [
        {"full_name": "Nguyễn Văn A", "cccd": "079012345671", "gender": "Nam", "job": "Kỹ sư", "hh": household_docs[0].name},
        {"full_name": "Phạm Thị D", "cccd": "079012345672", "gender": "Nữ", "job": "Giáo viên", "hh": household_docs[0].name},
        {"full_name": "Trần Thị B", "cccd": "079012345673", "gender": "Nữ", "job": "Kinh doanh", "hh": household_docs[1].name},
        {"full_name": "Lê Hoàng C", "cccd": "079012345674", "gender": "Nam", "job": "Nghỉ hưu", "hh": household_docs[2].name}
    ]

    for r in residents:
        if not frappe.db.exists("Resident", {"cccd": r["cccd"]}):
            res = frappe.get_doc({
                "doctype": "Resident",
                "full_name": r["full_name"],
                "cccd": r["cccd"],
                "gender": r["gender"],
                "household": r["hh"],
                "residency_status": "Thường trú"
            })
            res.insert(ignore_permissions=True)
            print(f"Inserted Resident: {r['full_name']}")
            
    frappe.db.commit()
    print("Seed data successfully!")
