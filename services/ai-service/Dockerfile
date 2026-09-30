# ==============================================================================
# TripSense AI Service - Multi-Stage Production Dockerfile
# ==============================================================================

# --- Stage 1: Build TypeScript Application ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Install all dependencies (including devDependencies)
COPY package*.json ./
COPY scripts/ ./scripts/
RUN npm ci

# Copy TypeScript configs and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8089

# Create non-privileged user and group for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 tripsense

# Copy dependency specifications and patch scripts
COPY package*.json ./
COPY scripts/ ./scripts/

# Install only production dependencies and ensure Gemini 3 patch is applied
RUN npm ci --omit=dev && \
    node scripts/patch-google-provider.js

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Adjust file ownership to non-root user
RUN chown -R tripsense:nodejs /app
USER tripsense

# Expose service port
EXPOSE 8089

# Container healthcheck probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8089/health || exit 1

# Start AI Service V2 daemon
CMD ["node", "dist/index.js"]
