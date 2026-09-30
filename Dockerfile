# ManakMitra — SIH26107
# Pack-only image. Optional LLM / Supabase keys are runtime env, not build secrets.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV HYBRID_RAG=0
# Skip db:migrate inside the image. Pack answers without Postgres.
RUN node scripts/with-app-env.mjs vite build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    HYBRID_RAG=0 \
    HOST=0.0.0.0 \
    PORT=8080
COPY --from=build /app /app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/with-app-env.mjs", "vite", "preview", "--host", "0.0.0.0", "--port", "8080"]
