<div align="center">

# Telos

**Say the goal. Learn it backward.**

*Name what you want to achieve — Telos reverse-derives the skills you actually need, teaches only your gaps, and verifies as it goes.*

`Open Source` · `Apache-2.0` · `Work in Progress`

**English** · [简体中文](README.zh-CN.md)

[Landing](https://yunyueli.github.io/telos/) · [Live Demo](https://yunyueli.github.io/telos/app/)

</div>

---

## What it is

Telos is a **backward-design** learning engine.

> Say the outcome you want → Telos reverse-derives the abilities needed → decomposes them into a prerequisite DAG → diagnoses what you already know → computes your **learning frontier (ZPD)** → teaches the gaps at your level → verifies mastery → repeats.

The first beachhead is **programming / technical skills**, where mastery can be verified objectively (run the tests) and the loop is cleanest — but the engine is domain-aware (see below).

## What works today

- **Reverse-derive any goal** into a skill DAG via an LLM (run it locally with `core/serve.py`, or a Cloudflare Worker for the public site — your API key stays server-side, never in the front-end).
- **Expert-level decomposition.** Nodes are *trainable can-do abilities*, each with a deliberate-practice **drill** and a measurable **benchmark** — not a shallow topic list. (Grounded in deliberate practice, EPA/CEFR competency frameworks.)
- **Six domain classes** (A declarative · B well-structured procedural · C creative · D motor · E open-adversarial · F habit) drive different diagnosis & review strategies.
- **Adaptive placement diagnosis.** Diagnostic-distractor MCQs + confidence (Certainty-Based Marking) folded into Bayesian Knowledge Tracing, with information-gain item selection over the prerequisite DAG — replacing crude yes/no self-report.
- **Full-page micro-lessons.** Explanation → "understand it through what you already know" analogy → worked example → a check question that feeds the engine; plus recommended best public courses.
- **Spaced review (FSRS-4.5).** What you learn flows into a review screen; due cards reschedule on each grade.
- **Knowledge map.** React Flow canvas — horizontal on desktop, a vertical guided path on mobile — click any node for details and to start learning.
- **Game layer v1.** XP from *real learning signals* (mastery gains, on-time reviews, goal unlocks) + streaks — never tied to time-on-app.

## Three open standards

Telos splits the paradigm into three independently usable, interoperable data standards:

| Standard | Role |
| --- | --- |
| **Outcome Spec** | Structures a one-line goal into a reverse-derivable spec |
| **Knowledge Graph** | A prerequisite DAG of trainable abilities |
| **Learner State** | Single-writer, versioned mastery state |

## Repo layout

| Path | What | Status |
| --- | --- | --- |
| `core/` | Learning engine (Python, zero-dependency): KST · BKT+CBM diagnosis · FIRe credit propagation · FSRS review · LLM reverse-derivation | ✅ 21 tests pass |
| `web/` | Product (Next.js + React + Tailwind + TypeScript, static export) | 🚧 active |
| `workers/` | Cloudflare Worker LLM proxy (`/derive` · `/lesson` · `/probe`) | ✅ |
| `landing/` | Landing page (static HTML — the design reference) | ✅ |
| `docs/STRATEGY.md` | Research-backed roadmap & decisions | ✅ |

## Quick start

```bash
# Landing page — open in a browser
open landing/index.html

# Engine (zero-dependency, pure stdlib)
cd core
python3 run_tests.py      # 21 tests
python3 demo.py           # end-to-end demo
python3 derive.py "用 Rust 写一个高性能 HTTP 服务器"   # reverse-derive (needs a key — see DERIVE.md)

# Web Demo
cd web
npm install --legacy-peer-deps
npm run dev               # http://localhost:3000
```

To **reverse-derive any goal in the web app**, run the local proxy and point the app at it:

```bash
cd core && python3 serve.py     # http://127.0.0.1:8787  (reads your key from core/.env)
# then, in another shell:
cd web && NEXT_PUBLIC_TELOS_DERIVE_URL=http://127.0.0.1:8787/derive npm run dev
```

See **[DERIVE.md](DERIVE.md)** to enable this (local key, or a Cloudflare Worker for the public site). **Never commit your API key.**

## Design language

Pure black-and-white on warm paper; a bold serif (Fraunces) + clean sans (Inter) + mono (JetBrains Mono); hand-drawn line icons with a sketch filter; editorial layout. The brand mascot is a young teacher character, monochrome ink, one character across many poses.

## Research & prior art

Backward design (Understanding by Design), Knowledge Space Theory & ALEKS adaptive assessment, Zone of Proximal Development, Bayesian Knowledge Tracing (and its link to IRT), Certainty-Based Marking, FSRS spaced repetition, deliberate practice (Ericsson), EPA/CEFR/ACS competency frameworks, situational judgment tests, and misconception-as-distractor design (FCI). Full citations in [docs/STRATEGY.md](docs/STRATEGY.md).

## License

[Apache-2.0](./LICENSE)
