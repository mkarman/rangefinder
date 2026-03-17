# ─────────────────────────────────────────────────────────────────────────────
# RangeFinder — Dockerfile
#
# Single-stage build using node:20-alpine.
# The Express server serves both the static HTML/CSS/JS and the API endpoints,
# so no separate nginx container is needed.
#
# Local usage:
#   docker build -t rangefinder .
#   docker run -p 3000:3000 --env-file .env rangefinder
#
# Production: built by CI, pushed to ECR, run on ECS Fargate.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS runtime

# Install dumb-init for proper PID 1 signal handling (SIGTERM → graceful shutdown)
RUN apk add --no-cache dumb-init

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# ── Install production dependencies first (layer-cached unless package.json changes) ──
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force

# ── Copy application source ──
# Static assets (served by Express)
COPY index.html           ./
COPY request-range.html   ./
COPY become-affiliate.html ./
COPY css/                 ./css/
COPY js/                  ./js/

# Server source
COPY server/              ./server/

# ── Set ownership ──
RUN chown -R appuser:appgroup /app

USER appuser

# ── Runtime configuration ──
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check — matches the GET /health endpoint in server/index.js
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Use dumb-init as PID 1 so Node receives SIGTERM correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/index.js"]
