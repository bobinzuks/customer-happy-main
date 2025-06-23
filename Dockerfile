# Multi-stage Docker build for CustomerHappy SaaS

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S customerapp -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=customerapp:nodejs /app/dist ./dist
COPY --from=builder --chown=customerapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=customerapp:nodejs /app/package*.json ./
COPY --from=builder --chown=customerapp:nodejs /app/prisma ./prisma
COPY --from=builder --chown=customerapp:nodejs /app/public ./public

# Create uploads directory
RUN mkdir -p ./uploads && chown customerapp:nodejs ./uploads

# Switch to app user
USER customerapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "dist/server.js"]