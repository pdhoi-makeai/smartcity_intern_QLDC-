#!/bin/bash
set -e

cd /home/user/Smart_City_V2/backend/v16-bench

# Uninstall old app
bench --site smartcity.localhost uninstall-app ha_tang_do_thi --force --yes || true
bench remove-app ha_tang_do_thi --force || true

# Create new app
if [ ! -d "apps/quan_ly_dan_cu" ]; then
  printf "Quan Ly Dan Cu\nResident Management System\nSmart City\nadmin@smartcity.localhost\n\n\nmit\n" | bench new-app quan_ly_dan_cu
fi

# Install new app
bench --site smartcity.localhost install-app quan_ly_dan_cu

# Copy python script and execute
cp /home/user/Smart_City_V2/setup_doctypes_dan_cu.py apps/quan_ly_dan_cu/quan_ly_dan_cu/setup_doctypes_dan_cu.py
bench --site smartcity.localhost execute quan_ly_dan_cu.setup_doctypes_dan_cu.execute

echo "Setup backend cho Quản lý dân cư hoàn tất!"
