# Roadmap

Telos is a reverse-design learning product: goal to graph, diagnosis, focused lessons, verification, and spaced review.

This roadmap is for the public Community Edition.

## Now

- Local-first web app with learning maps, diagnosis, review, settings, studio, and project state.
- Zero-dependency Python core engine with KST, BKT/CBM-style diagnosis, FIRe propagation, frontier selection, and FSRS-style review.
- Local reference runtime at `core/serve.py`.
- Static export for `landing/` plus `/app/`.
- BYOK model access through local configuration or direct provider calls.
- Agent skill package in `skill/`.

## Next

- Improve first-run onboarding for self-hosted users.
- Add more public example graphs and demo datasets.
- Tighten accessibility on dense graph and lesson states.
- Expand test coverage around graph normalization and multilingual lesson contracts.
- Improve Docker and static-host deployment ergonomics.
- Add community template contribution guidelines.

## Later

- More graph layout modes for non-DAG learning paths.
- Public schema versioning for LearningPath packages.
- Better import/export with common study formats.
- Optional self-host sync reference implementation.
- More agent-runtime integrations.

Hosted Telos has its own private roadmap for managed sync, production operations, billing, quota management, premium content operations, and internal evaluation.
