# syntax=docker/dockerfile:1
# ManakMitra — SIH26107
# Pack-only image. Optional LLM / Supabase / auth keys are runtime env, not build secrets.
# Vercel keeps the vercel Nitro preset. This image builds a standalone Node server.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV HYBRID_RAG=0 \
    NITRO_PRESET=node-server
RUN node scripts/with-app-env.mjs vite build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    HYBRID_RAG=0 \
    HOST=0.0.0.0 \
    PORT=8080 \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=8080
RUN apk add --no-cache dumb-init \
    && mkdir -p src/data \
    && chown -R node:node /app
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/src/data/rag-pack.json ./src/data/rag-pack.json
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", ".output/server/index.mjs"]
