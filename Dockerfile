# VisualStack - one image that serves BOTH the API and the built web app (single origin).
#   docker build -t visualstack .
#   docker run -p 5000:5000 --env-file apps/server/.env -e NODE_ENV=production visualstack
FROM node:22-slim

# Prisma needs OpenSSL; argon2 ships prebuilt binaries for glibc (hence -slim, not alpine).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Install dependencies first (cached unless a package.json changes).
#    --include=dev: TypeScript, Vite and the Prisma CLI are devDependencies and are needed to build and migrate.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --include=dev

# 2) Build: Prisma client, web bundle (apps/web/dist), API (apps/server/dist).
COPY . .
RUN npm run db:generate && npm run build

ENV NODE_ENV=production \
    PORT=5000 \
    SERVE_WEB=true
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations (safe: never resets data), then start the server.
CMD ["sh", "-c", "npm run db:deploy && npm run start"]
