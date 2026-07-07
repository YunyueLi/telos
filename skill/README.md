# Telos skill

A [Claude Agent Skill](https://agentskills.io) wrapper around **Telos Core**, the
portable backward-design learning engine. It lets any Skill-supporting agent
(agentskills.io / openclaw / Claude Code) run the full learning loop:

> goal → knowledge graph → adaptive diagnosis → learner state → learning
> frontier (ZPD) → teach/verify → FIRe credit propagation → FSRS spaced
> review → repeat.

The agent does the teaching and judges pass/fail; this skill does the
bookkeeping (graph, diagnosis, frontier, mastery propagation, scheduling).

## Layout

```
skill/
├── SKILL.md                      # the skill: trigger + when/how, for the agent
├── README.md                     # this file
├── scripts/
│   └── telos.py                  # zero-dependency CLI over telos_core
└── references/
    └── data-standards.md         # JSON shapes: Outcome Spec / Graph / State
```

## Install / use

Pure Python standard library — **nothing to install**. The CLI auto-locates
`telos_core` from the monorepo at `../core` (this skill lives at `<repo>/skill`).

```bash
# from skill/
python3 scripts/telos.py demo     # full loop, readable trace
python3 scripts/telos.py graph    # the seed knowledge graph as JSON
```

If you copy the skill out of the monorepo, install the engine so the import
still resolves:

```bash
pip install -e <path-to>/core    # exposes telos_core on sys.path
```

### CLI subcommands

| Command    | What it does                                                                 |
| ---------- | ---------------------------------------------------------------------------- |
| `graph`    | Print the seed knowledge graph (points + prerequisites) as JSON.             |
| `demo`     | Run the end-to-end loop on the seed graph and print a readable trace.        |
| `diagnose` | `--answers '{"py":true,...}'` (or stdin) → adaptive diagnosis → Learner State JSON. |
| `next`     | `--state state.json` → recommended learning frontier + due reviews.          |
| `record`   | `--state state.json --point jwt --correct true --grade 3` → FIRe + FSRS, writes state back. |

See `SKILL.md` for the agent-facing instructions and the full loop, and
`references/data-standards.md` for the three JSON standards.

Typical session:

```bash
python3 scripts/telos.py diagnose --answers '{"py":true,"http":true,"types":true}' --out state.json
python3 scripts/telos.py next   --state state.json          # → teach recommended_next
python3 scripts/telos.py record --state state.json --point jwt --correct true --grade 3
python3 scripts/telos.py next   --state state.json          # repeat until goals_reached
```

## How it relates to the rest of the repo

| Component | Role |
| --------- | ---- |
| **`core/` (Telos Core)** | The engine this skill wraps — pure-Python, zero-dependency: KST, diagnosis, FIRe, FSRS, frontier, `TelosEngine`. The CLI is a thin adapter over its public API. |
| **`skill/` (this)** | Makes the engine runnable from any agent via `SKILL.md` + a JSON CLI. No engine logic of its own. |
| **`web/`** | The product UI. Its graph (`web/lib/graph.ts`) is the same FastAPI/JWT seed, so the skill, the engine, and the web demo all speak the same shapes. |

Same three open standards across all three — Outcome Spec, Knowledge Graph,
Learner State — so state produced here is consumable by the engine and the app.

## License

Apache-2.0 for the standalone skill/core package; see the repository `NOTICE`.
