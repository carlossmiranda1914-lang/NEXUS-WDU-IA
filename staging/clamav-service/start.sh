#!/bin/sh

echo "[CLAMAV-START] Configuring ClamAV directories and signatures..."
mkdir -p /run/clamav /var/lib/clamav /var/log/clamav
chmod 777 /run/clamav /var/lib/clamav /var/log/clamav

# Create ClamAV signature database with EICAR and baseline signatures
cat << 'EOF' > /var/lib/clamav/eicar.ndb
Eicar-Test-Signature:0:*:58354f2150254041505b345c505a58353428505e2937434329377d2445494341522d5354414e444152442d414e544956495255532d544553542d46494c452124482b482a
EOF

cat << 'EOF' > /var/lib/clamav/eicar.hdb
44d88612fea8a8f36de82e1278abb02f:68:Eicar-Test-Signature
EOF

chmod 666 /var/lib/clamav/*

# Configure clamd.conf
cat << 'EOF' > /etc/clamav/clamd.conf
DatabaseDirectory /var/lib/clamav
TCPSocket 3310
TCPAddr 127.0.0.1
MaxConnectionQueueLength 30
MaxThreads 10
ReadTimeout 120
CommandReadTimeout 30
SendBufTimeout 200
MaxQueue 100
ExtendedDetectionInfo yes
User root
Foreground yes
LogTime yes
EOF

cp /etc/clamav/clamd.conf /etc/clamd.conf

# Start freshclam in background daemon mode
echo "[CLAMAV-START] Starting freshclam daemon in background..."
freshclam -d -c 4 &

# Start HTTP bridge in foreground (which spawns clamd)
echo "[CLAMAV-START] Starting ClamAV HTTP/TCP bridge on port ${PORT:-8080}..."
exec node server.mjs
