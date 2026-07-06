# Telos Product

This is the private source repository for the official Telos hosted product at
[telos.ungetsu.net](https://telos.ungetsu.net/).

Telos now follows an open-core model:

- **Telos Core / Community Edition** is Apache-2.0 and contains the reusable
  learning engine, data contracts, reference server/CLI, examples, and skill
  package.
- **Telos Product** is proprietary and contains the official web app, landing
  pages, Cloudflare Worker/API service layer, hosted-AI metering, billing,
  template store, brand assets, official UI/UX, and growth surfaces.

Do not publish this repository or copy product-layer code into the public core
repository.

## Production

- Frontend: Cloudflare Pages project `telos`
  - production branch: `main`
  - build command: `bash scripts/build-pages.sh`
  - output directory: `deploy`
  - public routes: `/` for landing, `/app/` for the product app
- API: Cloudflare Worker `telos-derive`
  - public route: `https://telos-api.ungetsu.net`
  - secrets stay in Wrangler/Cloudflare, never in Git

## Local Development

```bash
./start.sh
```

This starts the local reference proxy from `core/` and the Next.js product app.

## Repository Boundary

See [OPEN_CORE.md](OPEN_CORE.md), [TRADEMARK.md](TRADEMARK.md), and
[CONTRIBUTING.md](CONTRIBUTING.md).
