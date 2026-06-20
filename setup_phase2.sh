#!/bin/bash
set -e

mkdir -p /home/user/Smart_City_V2/backend
cd /home/user/Smart_City_V2/backend

if [ ! -d "v16-bench" ]; then
  bench init v16-bench --frappe-branch version-16 --python /usr/bin/python3
fi

cd v16-bench

# Create site if it doesn't exist
if [ ! -d "sites/smartcity.localhost" ]; then
  export PGPASSWORD='frappe123456'
  bench new-site smartcity.localhost \
    --db-type postgres \
    --db-root-username frappe \
    --db-root-password frappe123456 \
    --admin-password admin123456
fi

bench --site smartcity.localhost enable-scheduler
bench --site smartcity.localhost set-config developer_mode 1
bench use smartcity.localhost

# Create app if it doesn't exist
if [ ! -d "apps/ha_tang_do_thi" ]; then
  printf "Ha Tang Do Thi\nSmart City Infrastructure\nSmart City\nadmin@smartcity.localhost\n\n\nmit\n" | bench new-app ha_tang_do_thi
fi

bench --site smartcity.localhost install-app ha_tang_do_thi

# Update site_config.json for Redis and CORS
python3 -c "
import json
import os

config_path = 'sites/smartcity.localhost/site_config.json'
with open(config_path, 'r') as f:
    config = json.load(f)

config['redis_cache'] = 'redis://localhost:13000'
config['redis_queue'] = 'redis://localhost:11000'
config['redis_socketio'] = 'redis://localhost:12000'
config['use_openstreetmap'] = True

if 'cors_cors_origins' not in config:
    config['cors_cors_origins'] = []
config['cors_cors_origins'] = list(set(config['cors_cors_origins'] + ['http://localhost:5173', 'http://127.0.0.1:5173']))

with open(config_path, 'w') as f:
    json.dump(config, f, indent=1)
"

bench clear-cache
