<div align="center">

<img src="web/public/portraits/hero.png" width="116" alt="Telos" />

# Telos

**Say the goal. Learn it backward.**

*Name what you want to achieve — Telos reverse-derives a module-by-module map of the skills you actually need, diagnoses what you already know, and teaches only your gaps.*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-111.svg)](LICENSE)
&nbsp;[![Release](https://img.shields.io/github/v/release/YunyueLi/telos?style=flat&color=111&label=Release)](https://github.com/YunyueLi/telos/releases)
&nbsp;[![Stars](https://img.shields.io/github/stars/YunyueLi/telos?style=flat&color=111&label=Stars)](https://github.com/YunyueLi/telos)
&nbsp;[![中文](https://img.shields.io/badge/README-中文-111.svg)](README.zh-CN.md)

### ▶ [**Try it now**](https://telos.ungetsu.net/app/) — no install; bring your own key, free

<sub>[Landing](https://telos.ungetsu.net/) · [Run it yourself](#run-it-yourself-one-command) · [How it works](#how-it-works) · [Free & Pro](#free--pro) · [Deploy your own](#deploy-your-own)</sub>

</div>

---

The hosted app above runs the full loop in your browser — type any goal and watch Telos build a complete, staged knowledge map. Nothing to install; sign in and bind your own API key once — it's bound to your account (sent per request to the derive endpoint, never stored there), so signing in on any device connects automatically and signing out clears it locally. A **login-to-use hosted AI tier** (no key at all) is rolling out — see [Free & Pro](#free--pro).

```
goal ─▶ reverse-derive ─▶ a module-organized prerequisite map (30–80 trainable skills)
     ─▶ diagnose what you know (a few smart questions) ─▶ your learning frontier
     ─▶ teach only the gaps (interactive micro-lessons) ─▶ verify ─▶ spaced review ─▶ repeat
```

## Which way is for you?

| | **Use the hosted app** | **Run locally** | **Deploy your own** |
| --- | --- | --- | --- |
| **For** | Just want to learn | Try it / hack on it | Run your own public instance |
| **Setup** | Sign in | `git clone` + 1 API key + `make` | Fork + 1-click Worker |
| **Needs a key?** | Yes for now — bind once (key-free hosted AI rolling out) | Yes (DeepSeek / OpenAI / compatible) | Yes (your users bring their own) |
| **Your data** | Browser (+ optional account sync) | Your machine | Your users' browsers / your Supabase |
| **Go** | **[Open the app ▶](https://telos.ungetsu.net/app/)** | [↓ Run it yourself](#run-it-yourself-one-command) | [↓ Deploy your own](#deploy-your-own) |

> New here? **Just [open the hosted app](https://telos.ungetsu.net/app/)** — sign in, bind your key, type a goal, watch it build your map. The rest of this README is for running or hosting it yourself.

## Run it yourself (one command)

```bash
git clone https://github.com/YunyueLi/telos && cd telos
make          # or: ./start.sh
```

That's it. `make` copies `core/.env` from the template (and tells you where to get a key), installs web deps on first run, then starts the derive proxy **and** the web app and opens your browser. The app auto-connects to the local proxy — no env vars, no second terminal.

> Need a key? Telos works with any **OpenAI-compatible** provider — e.g. **DeepSeek** ([platform.deepseek.com](https://platform.deepseek.com)) or OpenAI. Paste the key into `core/.env` and refresh. (You can also paste your key + endpoint directly in the app under *Settings · Connections* — no `.env` needed.)

| Command | What it does |
| --- | --- |
| `make` / `./start.sh` | Run everything locally (proxy + web), open the browser |
| `make test` | Run the engine test suite (Python, zero dependencies) |
| `make build` | Production build of the web app (static export) |
| `make help` | List all commands |

## What works today

- **Reverse-derive any goal** into a *module-organized* prerequisite map — a blueprint pass picks the stages, then each module is expanded in parallel and stitched into one acyclic graph (typically **30–80 trainable skills across 6–9 stages**, scaled to the goal's breadth).
- **Trainable abilities, not topic lists.** Every node is an observable *can-do* skill with a deliberate-practice **drill** and a measurable **benchmark** (novice / proficient / elite) — grounded in deliberate practice and EPA/CEFR/Bloom competency frameworks.
- **A map you can actually read.** XMind-style stage bands with a tidy trunk-tree layout inside each stage and tiered edges (rounded trunk lines vs. faint cross-stage references), always reading left→right; phones get a dedicated path view.
- **Adaptive placement diagnosis.** Misconception-distractor MCQs + confidence (Certainty-Based Marking) folded into Bayesian Knowledge Tracing, with information-gain item selection over the graph — it asks ~14 smart questions and infers the rest, instead of crude self-report.
- **Interactive micro-lessons.** Predict → intuition → worked example → self-explain → faded practice → an unscaffolded mastery check — plus real, linkable courses (optionally web-grounded so links never hallucinate).
- **Spaced review (FSRS-4.5).** What you learn flows into a review queue; due cards reschedule on each grade.
- **Six domain classes** (declarative · procedural · creative · motor · adversarial · habit) drive different diagnosis & review strategies — so it works for math *and* a sport *and* a habit.
- **Keep-going system** (the *Streak* tab) — daily goal with a progress ring, a month-view check-in calendar, streak freeze, levels & tiers, and achievements. All bound to *real learning signals* (mastery & review), never time-on-app, with anti-dark-pattern guards.
- **Official template store** (`/store`) — hand-curated, pre-calibrated maps you import in one tap (launch set: postgraduate-exam English, Python backend interviews, and a free driving-test map). Paid template content is delivered from the server after purchase — never shipped to the public bundle — and Pro unlocks every official template.
- **Own your results.** PNG map export (watermark-free on Pro), **Anki deck export** (official text format — FSRS keeps scheduling inside Anki), and a serial-numbered **completion certificate** when a project hits 100% (Pro).
- **Accounts & cross-device sync** (optional, Supabase) — email/password, magic link, or Google; your projects and progress follow you across devices. Without it, everything stays local-first in your browser.
- **Nine languages** with a self-built i18n layer (zh-CN/TW · en · fr · ja · ko · es · ru · de); dates & relative times localized via `Intl`.

## How it works

Telos is a **backward-design** engine. You name an outcome; it works backward to the prerequisites, finds where *you* are on that map (your Zone of Proximal Development), and teaches forward from there — verifying mastery at every step and scheduling spaced review so it sticks.

It splits the paradigm into three independently usable, interoperable data standards:

| Standard | Role |
| --- | --- |
| **Outcome Spec** | Structures a one-line goal into a reverse-derivable spec |
| **Knowledge Graph** | A prerequisite DAG of trainable abilities, grouped into stages |
| **Learner State** | Single-writer, versioned mastery state |

## Free & Pro

Telos is open-source and **BYOK-first: bring your own key and the whole learning loop is free and unlimited, forever.** Pro sells convenience and outcomes — never lock-in.

| | **Free** | **Pro** — $2.9/mo · $19/yr · $49 once |
| --- | --- | --- |
| Learning engine with your own key | Unlimited | Unlimited |
| **Hosted AI** — no key, sign in & use | Trial: 3 derivations · 60 micro-lessons | 30 derivations · 600 micro-lessons / month, + top-up packs |
| Learning projects | 3 | Unlimited |
| Map export | With watermark | Watermark-free + **Anki deck export** |
| Template store | Free templates | All official templates unlocked |
| Completion certificate | — | Serial-numbered PNG |

Notes: the one-time *lifetime* plan includes everything **except** the hosted-AI quota (recurring LLM cost can't be bought once). Hosted AI and checkout are rolling out on the public instance — in-app pricing lives at `/pro`, the store at `/store`. Self-hosted instances ship with all billing **off** by default; enabling it is optional ([deploy notes](#deploy-your-own)).

## Configuration & API key

- **Hosted app (BYOK):** sign in, then bind your own LLM key in *Settings · Connections*. It's sent with each request to the derive Worker (never stored there) and bound to your account — sign in on any device to connect automatically, sign out to clear it locally.
- **Local:** put your API key (DeepSeek / OpenAI / any OpenAI-compatible) in `core/.env` (see above), or paste your key + endpoint in the app under *Settings · Connections*. **Never commit a key** — `core/.env` is git-ignored.
- **Optional web search** (real, clickable lesson links instead of search pages): set `TELOS_SEARCH_PROVIDER=tavily` + a key in `core/.env`. Degrades gracefully if absent.

Full details — local key, Cloudflare Worker, search providers, anti-abuse — in **[DERIVE.md](DERIVE.md)**.

## Deploy your own

A static frontend (**GitHub Pages**) + a **Cloudflare Worker** that orchestrates the multi-pass derivation — and, optionally, hosted-AI metering and billing. In **BYOK** mode the Worker uses each user's own key (passed per request, never stored); for a private instance it can hold your key as a fallback. The Worker is the only required backend — everything else degrades gracefully.

**1 · Backend — one click, no CLI:**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YunyueLi/telos/tree/main/workers)

Sign in to Cloudflare (free), then add a secret **`TELOS_LLM_API_KEY`** (your DeepSeek/OpenAI key) under the Worker's *Settings → Variables and Secrets*. You get a `https://telos-derive.<sub>.workers.dev` URL.

**2 · Frontend:** fork → GitHub Pages builds automatically. Point it at your Worker via the Actions **Variable** `NEXT_PUBLIC_TELOS_DERIVE_URL` = `…workers.dev/derive` (or just paste the URL in-app, stored per-browser).

**Optional — all degrade gracefully if skipped:**

| Add | Enables | Skip → fallback |
| --- | --- | --- |
| Tavily key (Worker secret `TELOS_SEARCH_API_KEY`) | Real, clickable lesson links | Platform search links |
| [Supabase](SUPABASE.md) project | Accounts + cross-device sync | Local-first (browser only) |
| Google / GitHub OAuth | Social login | Email + magic-link |
| KV namespace `TELOS_USAGE` (+ Supabase vars on the Worker) | **Hosted AI** — users sign in & use your key, metered per account (trial/monthly quotas, top-up packs) | BYOK-only |
| Billing provider (Creem / Lemon Squeezy) + `BILLING_WEBHOOK_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` | **Telos Pro payments** — subscriptions, packs, paid templates via `/billing/webhook` | Everything runs on the free tier |

Full walkthrough — CLI alternative, secrets, anti-abuse, search providers: **[DERIVE.md](DERIVE.md)** · accounts & sync: **[SUPABASE.md](SUPABASE.md)** · activation checklists (hosted AI, payments): **[docs/HANDOFF.md](docs/HANDOFF.md)**.

## Repo layout

| Path | What | Status |
| --- | --- | --- |
| `core/` | Learning engine (Python, zero-dependency): KST · BKT+CBM diagnosis · FIRe credit propagation · FSRS review · multi-pass LLM reverse-derivation | ✅ tests pass |
| `web/` | Product (Next.js + React + Tailwind + TypeScript, static export): map · diagnose · review · streak · store · pro · me/settings | 🚧 active |
| `workers/` | Cloudflare Worker: LLM proxy (`/derive` · `/lesson` · `/probe` · `/title`) + hosted-AI gate & KV metering (`/billing/usage`) + billing webhook (`/billing/webhook`) | ✅ |
| `landing/` | Marketing landing page (static HTML) | ⚠️ legacy — being rebuilt to match the app |
| `docs/DESIGN.md` | Design system reference (the visual baseline is the app) | ✅ |
| `docs/STRATEGY.md` | Research-backed roadmap & decisions | ✅ |
| `CHANGELOG.md` | Release notes | ✅ |

## For contributors — the engine, bare

```bash
make test                                       # engine test suite (zero deps)
cd core && python3 demo.py                       # end-to-end demo, no web
cd core && python3 derive.py "用 Rust 写高性能 HTTP 服务器"   # reverse-derive in the terminal (needs a key)
```

## Design language

Pure black-and-white on warm paper; a bold serif (Fraunces) + clean sans (Inter) + mono (JetBrains Mono); hand-drawn line icons; a young-teacher mascot in monochrome ink. Full system — tokens, components, gamification visuals, motion — in **[docs/DESIGN.md](docs/DESIGN.md)**.

## Research & prior art

Backward design (Understanding by Design), Knowledge Space Theory & ALEKS, the Zone of Proximal Development, Bayesian Knowledge Tracing, Certainty-Based Marking, FSRS spaced repetition, deliberate practice (Ericsson), EPA/CEFR/ACS competency frameworks, and misconception-as-distractor design — full citations in [docs/STRATEGY.md](docs/STRATEGY.md).

## License

[Apache-2.0](./LICENSE)
