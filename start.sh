#!/bin/sh

# Start logging everything to api.log
echo "Starting deployment sequence..." > api.log

# FIX: Ensure SQLite data directory exists and is writable (Zero Drama for VPS)
mkdir -p /app/data
chmod 777 /app/data

# FIX: Fallback DATABASE_URL if user forgot to set it in Coolify
export DATABASE_URL=${DATABASE_URL:-"file:///app/data/dev.db"}
echo "Using DATABASE_URL=$DATABASE_URL" >> api.log

# Push Prisma schema to database
echo "Running prisma db push..." >> api.log
cd backend
npx prisma db push --accept-data-loss >> ../api.log 2>&1
cd ..

# Start Backend on port 5001 in background
echo "Starting backend..." >> api.log
PORT=5001 npm start --workspace=backend >> api.log 2>&1 &

# Wait a second to let API start
sleep 2

# Start Frontend (Node.js Proxy & Static Server) on port 3000 in foreground
echo "Starting frontend server..."
PORT=3000 npm start --workspace=frontend
