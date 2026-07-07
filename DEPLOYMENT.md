# Deployment

Telos Community Edition can be run locally, exported as static files, or self-hosted with the reference runtime.

## Local Development

```bash
./start.sh
```

This starts:

- web app: `http://localhost:3000`
- reference runtime: `http://127.0.0.1:8787`

## Static Export

```bash
bash scripts/build-pages.sh
```

Output is written to `deploy/`:

- `/` contains the landing page from `landing/`
- `/app/` contains the exported Next.js app from `web/out/`
- clean aliases such as `/account`, `/settings`, `/review`, and `/studio` are copied for static hosts

By default, the public build does not inject any official hosted Supabase, billing, or production API configuration. To connect your own runtime, set:

```bash
NEXT_PUBLIC_TELOS_DERIVE_URL=https://your-runtime.example/derive
```

To add optional self-hosted account sync, set your own public Supabase project URL and publishable key. Do not commit those values.

## Docker

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). If you want AI generation, provide a `core/.env` file or pass the same variables through your container runtime.

## Hosted Telos

The official hosted product at [telos.ungetsu.net](https://telos.ungetsu.net/) is deployed from the private hosted-product repository. It includes managed sync, production Workers, billing, quota metering, premium content operations, and deployment automation.

The public repository should stay clean of production tokens, payment-provider IDs, Cloudflare account configuration, private template payloads, user data, and internal deployment scripts.
