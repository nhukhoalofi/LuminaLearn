FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Cài đặt Chromium, FFmpeg, Python, Fonts và các gói hệ thống
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    chromium \
    fonts-noto-core \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    fonts-liberation \
    python3 \
    python3-pip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt sympy và pnpm v9 (chuẩn với lockfileVersion 9.0)
RUN pip install --no-cache-dir --break-system-packages sympy
RUN npm install -g pnpm@9

# Thiết lập đường dẫn Chromium cho Remotion và Puppeteer trong container Linux
ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PYTHON_EXECUTABLE=python3

WORKDIR /app

# Stage 1: Cài đặt dependencies với pnpm 9
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/agent/package.json ./packages/agent/
COPY packages/animation/package.json ./packages/animation/
COPY packages/hybrid-renderer/package.json ./packages/hybrid-renderer/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/scene-schema/package.json ./packages/scene-schema/
COPY packages/validator/package.json ./packages/validator/

RUN pnpm install --frozen-lockfile

# Stage 2: Build source code
FROM deps AS builder

# Copy toàn bộ source code
COPY . .

# Build packages cốt lõi theo thứ tự phụ thuộc
RUN pnpm --filter @luminalearn/scene-schema build
RUN pnpm --filter @luminalearn/validator build
RUN pnpm --filter @luminalearn/agent build
RUN pnpm --filter @luminalearn/animation build

# Build Next.js Web App
RUN pnpm --filter @luminalearn/web build

# Stage 3: Runner production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Copy toàn bộ workspace đã build và node_modules từ builder
COPY --from=builder /app /app

# Tạo thư mục outputs để lưu trữ state tạm thời
RUN mkdir -p /app/outputs/.drafts-v3 /app/outputs/.jobs /app/outputs/videos

# Chạy Next.js app lắng nghe tất cả interface (0.0.0.0) trên cổng $PORT của Cloud Run
CMD ["sh", "-c", "pnpm --filter @luminalearn/web exec next start -H 0.0.0.0 -p ${PORT:-8080}"]
