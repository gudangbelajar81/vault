FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for SQLite/Prisma on Alpine (just in case, though we use MySQL now)
RUN apk add --no-cache openssl python3 make g++

# Install turbo if needed (we'll just use npm workspaces here)
# RUN npm install -g turbo

# Copy workspace configs
COPY package.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies (workspaces)
RUN npm install

# Copy all files
COPY . .

# Build frontend and backend
RUN npm run build --workspace=frontend
RUN cd backend && npx prisma generate && cd ..
RUN npm run build --workspace=backend

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# Copy files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./frontend/
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/server.js ./frontend/
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/start.sh ./

# Make start.sh executable
RUN chmod +x start.sh

# Expose the frontend proxy port
EXPOSE 3000

ENV NODE_ENV=production

CMD ["./start.sh"]
