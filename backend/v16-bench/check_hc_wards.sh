#!/bin/bash
cd /home/user/Smart_City_V2/backend/v16-bench
bench --site smartcity.localhost execute "[f'{w.name}: {w.ward_name}' for w in frappe.get_all('Ward', filters={'district': frappe.get_all('District', filters={'district_name': 'Hải Châu'})[0].name}, fields=['name', 'ward_name'])]"
