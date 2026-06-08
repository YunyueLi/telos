# Changelog

All notable changes to Telos are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [0.1.0] — 2026-06-08

First public release. Telos reverse-derives any goal into a prerequisite skill map, diagnoses what you already know, teaches only the gaps, and schedules spaced review — usable in the browser with zero setup.

### Engine — `core/` (Python, zero-dependency)
- Multi-pass LLM **reverse-derivation**: blueprint pass → parallel module expansion → stitched acyclic graph (typically 30–80 trainable skills across 6–9 stages).
- **Trainable abilities**, not topic lists — each node has a deliberate-practice drill and a measurable benchmark (novice / proficient / elite).
- **Adaptive placement diagnosis**: misconception-distractor MCQs + Certainty-Based Marking folded into Bayesian Knowledge Tracing, with information-gain item selection.
- FIRe credit propagation; **FSRS-4.5** spaced review.
- Six domain classes (declarative · procedural · creative · motor · adversarial · habit) driving different diagnosis/review strategies.

### Web app — `web/` (Next.js + React + Tailwind, static export)
- **Learning map** (React Flow) — prerequisite DAG with a highlighted learning frontier; mobile path view.
- **Interactive micro-lessons** (predict → intuition → worked example → self-explain → faded practice → mastery check), optionally web-grounded so links never hallucinate.
- Diagnose / Review / Map full-screen flows.
- **Streak tab («坚持») — research-grounded, Duolingo-style motivation**: daily goal + progress ring, month-view check-in calendar, streak freeze, levels & tiers, achievement badges, personal records — all bound to real learning signals (never time-on-app), with reduced-motion and anti-dark-pattern guards.
- **Accounts + cross-device sync** (Supabase): email/password, magic link, Google OAuth; last-write-wins per-project sync.
- Self-built **i18n in 9 languages** (zh-CN/zh-TW/en/fr/ja/ko/es/ru/de).
- Black-and-white editorial **design system** (Fraunces + Inter + JetBrains Mono, hand-drawn icons, monochrome mascot) — codified in `docs/DESIGN.md`.

### Online & deploy
- Hosted app on **GitHub Pages** with online derivation via a **Cloudflare Worker** (LLM key server-side, CORS-locked).
- **One-click "Deploy to Cloudflare"** button; committed `.env.example` templates; every optional integration (search / accounts / OAuth) degrades gracefully.

### Docs
- `README` (English) + `README.zh-CN`, `DERIVE.md`, `SUPABASE.md`, `docs/DESIGN.md`, `docs/STRATEGY.md`, `docs/HANDOFF.md`.

[0.1.0]: https://github.com/YunyueLi/telos/releases/tag/v0.1.0
