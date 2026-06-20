#!/bin/bash
set -e

cd /home/user/Smart_City_V2/backend/v16-bench

cp /home/user/Smart_City_V2/setup_doctypes_v3.py apps/quan_ly_dan_cu/quan_ly_dan_cu/setup_doctypes_v3.py
bench --site smartcity.localhost execute quan_ly_dan_cu.setup_doctypes_v3.execute

echo "Tạo mới 6 DocType thành công!"
