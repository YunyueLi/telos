# Runtime and AI Access

Telos needs an OpenAI-compatible model for goal decomposition, micro-lessons, and probes. Community Edition uses BYOK: bring your own key and run the reference runtime locally or on your own infrastructure.

## Local Runtime

```bash
cp core/.env.example core/.env
$EDITOR core/.env
cd core
python3 serve.py
```

The server listens on `127.0.0.1:8787` by default and exposes:

- `GET /health`
- `POST /derive`
- `POST /lesson`
- `POST /probe`
- `POST /title`

`./start.sh` starts this runtime and the web app together.

## Environment

```bash
TELOS_LLM_API_KEY=your-api-key
TELOS_LLM_BASE_URL=https://api.deepseek.com
TELOS_LLM_MODEL=deepseek-v4-pro
TELOS_SEARCH_PROVIDER=none
TELOS_SEARCH_API_KEY=
```

The key stays in `core/.env`, which is ignored by Git.

## Request Shape

`POST /derive`

```json
{
  "goal": "Use Rust to build a high-performance HTTP server"
}
```

Response:

```json
{
  "goal": "Use Rust to build a high-performance HTTP server",
  "points": [
    {
      "id": "rust-ownership",
      "name": "Rust ownership model",
      "prereqs": [],
      "isGoal": false,
      "minutes": 35
    }
  ]
}
```

The web app and Python engine consume the same graph shape.

## Self-Hosting

The public reference runtime is plain Python standard library. You can run it behind your own reverse proxy, container platform, or internal agent runtime. Set:

```bash
TELOS_HOST=0.0.0.0
TELOS_PORT=8787
```

Then point the web app at:

```bash
NEXT_PUBLIC_TELOS_DERIVE_URL=https://your-domain.example/derive
```

The official hosted API, managed quota, billing, production Worker, and private deployment scripts are operated from the private hosted-product repository. Community Edition remains local-first and self-hostable.

## Optional Search

Without search, lessons use safe platform search links. With search, Telos fetches real sources first and asks the model to cite only those results.

```bash
TELOS_SEARCH_PROVIDER=tavily
TELOS_SEARCH_API_KEY=tvly-your-key
```

No model or search key should ever be committed to Git.
