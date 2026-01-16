FROM node:22-alpine

WORKDIR /app

# Install system dependencies for SQLite and tar
RUN apk add --no-cache sqlite tar gzip curl wget


# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source code
COPY . .

# Copy schema and seeds into the image (immutable assets)
# Expect seeds/seed.db to be provided from the repo
COPY schema /app/schema
COPY seeds /app/seeds
RUN chmod -R a-w /app/seeds || true

# Create directory for SQLite databases (data lives in a mounted volume)
RUN mkdir -p /app/data

# [DO NOT] Expose port 3010
#EXPOSE 3010

# Copy and configure entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Entrypoint handles first-run DB init and then execs the server
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server.js"]