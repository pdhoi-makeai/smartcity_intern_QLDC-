#!/bin/bash
echo "user" | sudo -S service postgresql start
echo "user" | sudo -S service redis-server start

echo "user" | sudo -S -u postgres psql <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'frappe') THEN
    CREATE ROLE frappe LOGIN SUPERUSER PASSWORD 'frappe123456';
  END IF;
END
\$\$;
EOF

echo "user" | sudo -S -u postgres psql <<EOF
SELECT 'CREATE DATABASE smart_city_db OWNER frappe' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'smart_city_db')\gexec
EOF

echo "user" | sudo -S -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE smart_city_db TO frappe;"
