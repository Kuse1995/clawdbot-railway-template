# =========================
# Build OpenClaw from source
# =========================

FROM node:22-bookworm AS openclaw-build

# Dependencies needed for openclaw build
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# Install Bun (openclaw build uses it)
RUN curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /openclaw

# Pin stable release
ARG OPENCLAW_GIT_REF=v2026.5.4

RUN git clone --depth 1 --branch "${OPENCLAW_GIT_REF}" https://github.com/openclaw/openclaw.git .

# Relax package requirements
RUN set -eux; \
  find ./extensions -name 'package.json' -type f | while read -r f; do \
    sed -i -E 's/"openclaw"[[:space:]]*:[[:space:]]*">=[^"]+"/"openclaw": "*"/g' "$f"; \
    sed -i -E 's/"openclaw"[[:space:]]*:[[:space:]]*"workspace:[^"]+"/"openclaw": "*"/g' "$f"; \
  done

RUN pnpm install --no-frozen-lockfile --config.minimum-release-age=0

RUN pnpm build

ENV OPENCLAW_PREFER_PNPM=1

RUN pnpm ui:install && pnpm ui:build


# =========================
# Runtime Image
# =========================

FROM node:22-bookworm

ENV NODE_ENV=production

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    python3 \
    python3-venv \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Install Cloudflare Tunnel
RUN curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared \
  && chmod +x /usr/local/bin/cloudflared

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate

# Persistent storage
ENV NPM_CONFIG_PREFIX=/data/npm
ENV NPM_CONFIG_CACHE=/data/npm-cache
ENV PNPM_HOME=/data/pnpm
ENV PNPM_STORE_DIR=/data/pnpm-store
ENV PATH="/data/npm/bin:/data/pnpm:${PATH}"

WORKDIR /app

# Install wrapper dependencies
COPY package.json ./

RUN npm install --omit=dev && npm cache clean --force

# Copy built OpenClaw
COPY --from=openclaw-build /openclaw /openclaw

# OpenClaw executable
RUN printf '%s\n' \
  '#!/usr/bin/env bash' \
  'exec node /openclaw/dist/entry.js "$@"' \
  > /usr/local/bin/openclaw \
  && chmod +x /usr/local/bin/openclaw

# Copy app source
COPY src ./src

EXPOSE 8080

# Proper signal handling
ENTRYPOINT ["tini", "--"]

# =========================
# Startup
# =========================

CMD ["sh", "-c", "\
mkdir -p /data/.openclaw && \
echo '{\"gateway\":{\"controlUi\":{\"allowedOrigins\":[\"*\"]}}}' > /data/.openclaw/config.json && \
cloudflared tunnel run --token $TUNNEL_TOKEN & \
node src/server.js \
"]
