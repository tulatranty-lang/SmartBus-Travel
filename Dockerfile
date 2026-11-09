FROM node:24-alpine AS ui
WORKDIR /build
COPY web/package*.json ./web/
RUN npm ci --prefix web --no-audit --no-fund
COPY web ./web
RUN npm --prefix web run build

FROM node:24-alpine
WORKDIR /app
COPY backend-api/package*.json ./backend-api/
RUN npm ci --prefix backend-api --omit=dev --no-audit --no-fund
COPY backend-api ./backend-api
COPY frontend ./frontend
COPY --from=ui /build/frontend/app ./frontend/app
COPY database ./database
COPY scripts ./scripts
COPY package.json ./
ENV NODE_ENV=production PORT=5000
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/v1/health/liveness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend-api/server.js"]
