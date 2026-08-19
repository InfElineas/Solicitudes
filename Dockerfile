# ── Etapa 1: Build ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

# ── Etapa 2: Serve ───────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Copiar build
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración nginx para SPA (todas las rutas → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
