# Estágio 1: Dependências (Node 22 — exigido por @capacitor/cli >=8)
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./
# `npm ci` falha quando package-lock e package.json não estão 100% sincronizados.
# No Cloud Build isso está bloqueando deploy; para o build do app usamos `npm install`.
RUN npm install

# Estágio 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copiar dependências do estágio anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de ambiente para build
ENV NEXT_TELEMETRY_DISABLED 1

# NEXT_PUBLIC_* embutidas no bundle — não colocar literais aqui (aparecem no log do Docker / no repo).
# Passar via Cloud Build: --build-arg a partir de .env (ver scripts/deploy-cloud-run.mjs).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
# Muda no cliente a cada build → novo URL do SW (?v=) e menos chunks 404 após deploy
ARG NEXT_PUBLIC_BUILD_ID=dev
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_BUILD_ID=$NEXT_PUBLIC_BUILD_ID

# Build da aplicação
RUN npm run build

# Verificar se o build standalone foi criado corretamente
RUN node scripts/verify-build.mjs || (echo "❌ Verificação do build falhou!" && exit 1)

# Estágio 3: Runner (Produção)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos necessários
# Primeiro copiar o standalone (que já inclui node_modules necessários)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Copiar arquivos estáticos
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copiar pasta public
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Verificar se os arquivos críticos foram copiados
RUN test -f server.js || (echo "❌ server.js não encontrado!" && exit 1) && \
    test -d .next/static || (echo "⚠️  .next/static não encontrado" && exit 1) && \
    echo "✅ Arquivos críticos verificados"

USER nextjs

# Expor porta (Cloud Run usa 8080 por padrão)
# Cloud Run define PORT automaticamente via variável de ambiente
EXPOSE 8080

# HOSTNAME para aceitar conexões de qualquer interface
ENV HOSTNAME="0.0.0.0"
# PORT será definido automaticamente pelo Cloud Run (padrão: 8080)
# Next.js standalone server.js usa process.env.PORT automaticamente

# Comando para iniciar
# Next.js standalone server.js usa automaticamente a variável PORT
CMD ["node", "server.js"]
