<div align="center">

<img src="web/public/portraits/hero.png" width="116" alt="Telos" />

# Telos

**Say the goal. Learn it backward.**

*Name what you want to achieve — Telos reverse-derives a module-by-module map of the skills you actually need, diagnoses what you already know, and teaches only your gaps.*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-111.svg)](LICENSE)
&nbsp;[![Stars](https://img.shields.io/github/stars/YunyueLi/telos?style=flat&color=111&label=Stars)](https://github.com/YunyueLi/telos)
&nbsp;[![中文](https://img.shields.io/badge/README-中文-111.svg)](README.zh-CN.md)

### ▶ [**Try it now**](https://yunyueli.github.io/telos/app/) — no install, no API key

<sub>[Landing](https://yunyueli.github.io/telos/) · [Run it yourself](#run-it-yourself-one-command) · [How it works](#how-it-works) · [Deploy your own](#deploy-your-own)</sub>

</div>

---

The hosted demo above runs the full loop in your browser — type any goal and watch Telos build a complete, staged knowledge map. Nothing to install; the API key lives server-side.

```
goal ─▶ reverse-derive ─▶ a module-organized prerequisite map (30–80 trainable skills)
     ─▶ diagnose what you know (a few smart questions) ─▶ your learning frontier
     ─▶ teach only the gaps (interactive micro-lessons) ─▶ verify ─▶ spaced review ─▶ repeat
```

## Which way is for you?

| | **Use the hosted app** | **Run locally** | **Deploy your own** |
| --- | --- | --- | --- |
| **For** | Just want to learn | Try it / hack on it | Run your own public instance |
| **Setup** | Nothing | `git clone` + 1 free key + `make` | Fork + 1-click Worker |
| **Needs a key?** | No (server-side) | Yes (free DeepSeek) | Yes (in your Worker) |
| **Your data** | Browser (+ optional account sync) | Your machine | Your users' browsers / your Supabase |
| **Go** | **[Open the app ▶](https://yunyueli.github.io/telos/app/)** | [↓ Run it yourself](#run-it-yourself-one-command) | [↓ Deploy your own](#deploy-your-own) |

> New here? **Just [open the hosted app](https://yunyueli.github.io/telos/app/)** — type a goal, watch it build your map. Zero setup, no key. The rest of this README is for running or hosting it yourself.

## Run it yourself (one command)

```bash
git clone https://github.com/YunyueLi/telos && cd telos
make          # or: ./start.sh
```

That's it. `make` copies `core/.env` from the template (and tells you where to get a **free** key), installs web deps on first run, then starts the derive proxy **and** the web app and opens your browser. The app auto-connects to the local proxy — no env vars, no second terminal.

> Need a key? **DeepSeek** is free to start — no credit card, ~5M free tokens. Grab one at **[platform.deepseek.com](https://platform.deepseek.com)**, paste it into `core/.env`, refresh. (You can also paste an endpoint directly in the app's *倒推 / Derive* page — no `.env` needed.)

| Command | What it does |
| --- | --- |
| `make` / `./start.sh` | Run everything locally (proxy + web), open the browser |
| `make test` | Run the engine test suite (Python, zero dependencies) |
| `make build` | Production build of the web app (static export) |
| `make help` | List all commands |

## What works today

- **Reverse-derive any goal** into a *module-organized* prerequisite map — a blueprint pass picks the stages, then each module is expanded in parallel and stitched into one acyclic graph (typically **30–80 trainable skills across 6–9 stages**, scaled to the goal's breadth).
- **Trainable abilities, not topic lists.** Every node is an observable *can-do* skill with a deliberate-practice **drill** and a measurable **benchmark** (novice / proficient / elite) — grounded in deliberate practice and EPA/CEFR/Bloom competency frameworks.
- **Adaptive placement diagnosis.** Misconception-distractor MCQs + confidence (Certainty-Based Marking) folded into Bayesian Knowledge Tracing, with information-gain item selection over the graph — it asks ~14 smart questions and infers the rest, instead of crude self-report.
- **Interactive micro-lessons.** Predict → intuition → worked example → self-explain → faded practice → an unscaffolded mastery check — plus real, linkable courses (optionally web-grounded so links never hallucinate).
- **Spaced review (FSRS-4.5).** What you learn flows into a review queue; due cards reschedule on each grade.
- **Six domain classes** (declarative · procedural · creative · motor · adversarial · habit) drive different diagnosis & review strategies — so it works for math *and* a sport *and* a habit.

## How it works

Telos is a **backward-design** engine. You name an outcome; it works backward to the prerequisites, finds where *you* are on that map (your Zone of Proximal Development), and teaches forward from there — verifying mastery at every step and scheduling spaced review so it sticks.

It splits the paradigm into three independently usable, interoperable data standards:

| Standard | Role |
| --- | --- |
| **Outcome Spec** | Structures a one-line goal into a reverse-derivable spec |
| **Knowledge Graph** | A prerequisite DAG of trainable abilities, grouped into stages |
| **Learner State** | Single-writer, versioned mastery state |

## Configuration & API key

- **Hosted demo:** nothing to configure — derivation runs through a Cloudflare Worker whose key stays server-side.
- **Local:** put a free DeepSeek key in `core/.env` (see above), or paste a `/derive` endpoint in the app. **Never commit a key** — `core/.env` is git-ignored.
- **Optional web search** (real, clickable lesson links instead of search pages): set `TELOS_SEARCH_PROVIDER=tavily` + a key in `core/.env`. Degrades gracefully if absent.

Full details — local key, Cloudflare Worker, search providers, anti-abuse — in **[DERIVE.md](DERIVE.md)**.

## Deploy your own

A static frontend (**GitHub Pages**) + a **Cloudflare Worker** that holds the LLM key server-side. The Worker is the only required piece — everything else degrades gracefully.

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

Full walkthrough — CLI alternative, secrets, anti-abuse, search providers: **[DERIVE.md](DERIVE.md)** · accounts & sync: **[SUPABASE.md](SUPABASE.md)**.

## Repo layout

| Path | What | Status |
| --- | --- | --- |
| `core/` | Learning engine (Python, zero-dependency): KST · BKT+CBM diagnosis · FIRe credit propagation · FSRS review · multi-pass LLM reverse-derivation | ✅ tests pass |
| `web/` | Product (Next.js + React + Tailwind + TypeScript, static export) | 🚧 active |
| `workers/` | Cloudflare Worker LLM proxy (`/derive` · `/lesson` · `/probe` · `/title`) | ✅ |
| `landing/` | Landing page (static HTML — the design reference) | ✅ |
| `docs/STRATEGY.md` | Research-backed roadmap & decisions | ✅ |

## For contributors — the engine, bare

```bash
make test                                       # engine test suite (zero deps)
cd core && python3 demo.py                       # end-to-end demo, no web
cd core && python3 derive.py "用 Rust 写高性能 HTTP 服务器"   # reverse-derive in the terminal (needs a key)
```

## Design language

Pure black-and-white on warm paper; a bold serif (Fraunces) + clean sans (Inter) + mono (JetBrains Mono); hand-drawn line icons; a young-teacher mascot in monochrome ink.

## Research & prior art

Backward design (Understanding by Design), Knowledge Space Theory & ALEKS, the Zone of Proximal Development, Bayesian Knowledge Tracing, Certainty-Based Marking, FSRS spaced repetition, deliberate practice (Ericsson), EPA/CEFR/ACS competency frameworks, and misconception-as-distractor design — full citations in [docs/STRATEGY.md](docs/STRATEGY.md).

## License

[Apache-2.0](./LICENSE)
