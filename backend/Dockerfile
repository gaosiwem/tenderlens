# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

COPY package.json package-lock.json* ./
# Omit --production so we get devDependencies (typescript, etc) for building
RUN npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production runtime dependencies
RUN apk add --no-cache \
    poppler-utils \
    graphicsmagick \
    ghostscript \
    openssl

# Copy built assets and production modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json* ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma

# Ensure writable runtime directories exist
RUN mkdir -p /app/media /app/storage && chown -R node:node /app/media /app/storage

# Optional: cleanup dev dependencies if needed, 
# but builder modules might contain production ones.
# Better to run 'npm prune --production' in builder stage if image size is critical.

ENV NODE_ENV=production
EXPOSE 8080

# Use a non-root user for security
USER node

CMD ["npm", "run", "start"]
