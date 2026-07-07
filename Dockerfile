FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix web --legacy-peer-deps

COPY core ./core
COPY web ./web

ENV TELOS_HOST=0.0.0.0
ENV TELOS_PORT=8787
ENV NEXT_PUBLIC_TELOS_DERIVE_URL=http://127.0.0.1:8787/derive

EXPOSE 3000 8787

CMD ["bash", "-lc", "cd core && python3 serve.py & cd web && npm run dev -- --hostname 0.0.0.0"]
