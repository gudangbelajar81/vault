FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy source code
COPY . .

# Build TS to JS
RUN npm run build

# Generate prisma client
RUN npx prisma generate

FROM node:20-alpine

WORKDIR /app

# Copy built artifacts and dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Start the server (ensure db push is run before starting if SQLite is used)
CMD ["sh", "-c", "npx prisma db push && npm start"]
