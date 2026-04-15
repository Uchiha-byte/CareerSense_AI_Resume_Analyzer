# Build Stage
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Run Stage
FROM node:20-slim
WORKDIR /app

# SQLite runtime dependencies
RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./

# Create data directory for persistent SQLite
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/careersense.db
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# The start-backend script or tsx
CMD ["npx", "tsx", "src/server.ts"]
