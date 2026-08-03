#!/bin/sh

# Push Prisma schema to database (MySQL)
echo "Running prisma db push..."
cd backend
npx prisma db push --accept-data-loss
cd ..

# Start Backend on port 5001 in background
echo "Starting backend..."
PORT=5001 npm start --workspace=backend > api.log 2>&1 &

# Wait a second to let API start
sleep 2

# Start Frontend (Node.js Proxy & Static Server) on port 3000 in foreground
echo "Starting frontend server..."
PORT=3000 npm start --workspace=frontend
