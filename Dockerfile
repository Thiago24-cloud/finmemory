# Estágio 1: Dependências
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json* ./
RUN npm ci

# Estágio 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar dependências do estágio anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de ambiente para build
ENV NEXT_TELEMETRY_DISABLED 1

# Variáveis públicas do Supabase (hardcoded - são públicas, vão para o navegador de qualquer forma)
ENV NEXT_PUBLIC_SUPABASE_URL=https://faxqrkxqfwjdavorxien.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheHFya3hxZndqZGF2b3J4aWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTE4NTYsImV4cCI6MjA4MTQyNzg1Nn0.nXGv3FGwFJWWTRLwEgBRgOmj-RJu-pv7vvZYmyiO_3s

# Mapbox (token público - passado no build pelo Cloud Build)
ARG NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
ENV NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=$NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

# Build da aplicação
RUN npm run build

# Verificar se o build standalone foi criado corretamente
RUN node scripts/verify-build.mjs || (echo "❌ Verificação do build falhou!" && exit 1)

# Estágio 3: Runner (Produção)
FROM node:20-alpine AS runner
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
