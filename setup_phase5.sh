#!/bin/bash
set -e

HOST_ENTRY="127.0.0.1 smartcity.localhost"

if ! grep -q "$HOST_ENTRY" /etc/hosts; then
  echo "user" | sudo -S bash -c "echo '$HOST_ENTRY' >> /etc/hosts"
  echo "Host entry added to /etc/hosts"
else
  echo "Host entry already exists in /etc/hosts"
fi
