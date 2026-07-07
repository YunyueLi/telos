# Security Policy

## Reporting

Use GitHub private security advisories for vulnerabilities in this repository. Please do not publish exploit details before there is a fix or mitigation path.

For routine bugs that do not expose data, secrets, account access, or execution paths, open a normal issue.

## Scope

In scope:

- local runtime request handling
- web app data isolation and local storage behavior
- dependency vulnerabilities with a practical Telos exploit path
- leakage risks in examples, docs, scripts, or build output

Out of scope:

- vulnerabilities in third-party model providers, Supabase, Cloudflare, or payment processors unless Telos integrates them unsafely
- denial-of-service reports without a practical reproduction
- reports against private hosted-product infrastructure that cannot be reproduced from this public repository

Never commit `.env` files, service-role keys, webhook secrets, model-provider keys, production tokens, private template payloads, user data, or real deployment credentials.
