# Dockerfile (Next.js standalone)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

# 1) Install deps without running postinstall (prisma generate)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2) Build
FROM base AS builder
WORKDIR /app
# bring in the installed deps
COPY --from=deps /app/node_modules ./node_modules

# bring in the project files (whitelist them or COPY . . if you have a good .dockerignore)
COPY package.json pnpm-lock.yaml* ./
COPY next.config.mjs ./
COPY tsconfig.json ./
# optional, if present
COPY postcss.config.cjs ./
COPY tailwind.config.cjs ./
COPY prisma ./prisma
COPY public ./public
COPY src ./src

# rebuild any skipped native deps (best-effort)
RUN pnpm rebuild -r || true

# generate prisma client (now prisma/ exists)
RUN npx prisma generate

# build next (produces .next/standalone + .next/static)
RUN pnpm build

# 3) Runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
EXPOSE 3000

# minimal server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]