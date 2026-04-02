# Imagem mínima para job só DIA (--only=dia): usa fetch + page-data, sem Chromium.
# Build (na raiz do repo): docker build -f finmemory-agent/Dockerfile -t finmemory-promo-dia:latest finmemory-agent
FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY agent.js ./
ENV NODE_ENV=production
# Defaults alinhados ao agente (capital SP, até 121 lojas num job)
ENV DIA_MAX_STORE_PAGES=250
ENV DIA_REGION_PAGE_PATHS=lojas-sp-capital
CMD ["node", "agent.js", "--only=dia"]
