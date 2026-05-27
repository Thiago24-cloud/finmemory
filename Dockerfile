# Monorepo FinMemory — app consumidor em apps/consumer
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages packages
COPY apps/consumer/package.json apps/consumer/
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

WORKDIR /app/apps/consumer
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ARG NEXT_PUBLIC_BUILD_ID=dev
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_FINMEMORY_PUBLIC_ACCESS
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_BUILD_ID=$NEXT_PUBLIC_BUILD_ID
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_FINMEMORY_PUBLIC_ACCESS=$NEXT_PUBLIC_FINMEMORY_PUBLIC_ACCESS

RUN npm run build

RUN node ../../scripts/verify-build.mjs

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone monorepo: server.js em apps/consumer/server.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/consumer/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/consumer/.next/static ./apps/consumer/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/consumer/public ./apps/consumer/public

RUN test -f apps/consumer/server.js || (echo "❌ apps/consumer/server.js não encontrado" && exit 1)

USER nextjs
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/consumer/server.js"]
