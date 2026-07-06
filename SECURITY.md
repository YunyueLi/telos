# Security Policy

This private repository contains the official hosted Telos product: web app,
Cloudflare Worker service layer, billing integration, Supabase integration,
curated templates, and brand/product assets.

## Reporting

Report sensitive issues through a private GitHub security advisory on this
repository. Do not open public issues or discussions for vulnerabilities,
secrets exposure, billing bypasses, auth/session bugs, hosted quota bypasses, or
template entitlement bypasses.

If a report affects Telos Core only, use the public `YunyueLi/telos`
security advisory flow instead.

## Scope

In scope:

- hosted product auth, sync, billing, metering, template access, and Worker API
- leakage of service-role credentials, webhook secrets, model keys, or private
  template content
- vulnerabilities that let a user access another user's data or hosted quota

Out of scope:

- generic dependency CVEs with no reachable Telos exploit path
- denial-of-service reports without a practical reproduction
- issues in third-party model providers, Supabase, Cloudflare, or payment
  processors unless Telos integrates them unsafely

Secrets must stay in Cloudflare, Supabase, and payment-provider secret stores.
Never commit `.env` files, service-role keys, webhook secrets, model provider
keys, or private template payloads.
