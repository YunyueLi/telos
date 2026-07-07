---
name: telos
description: Use this when you need to teach a learner a skill or hit a concrete goal and want it done by backward design — reverse-derive a knowledge graph from the goal, run adaptive diagnosis to find what they already know, compute the learning frontier (ZPD) of what to learn next, propagate mastery across prerequisites (FIRe), and schedule spaced reviews (FSRS). Reach for it for tutoring, onboarding plans, study/curriculum sequencing, "what should I learn next", or any place you'd otherwise guess at ordering and retention by hand.
---

# Telos — a backward-design learning engine

Telos turns a goal into a teachable plan and keeps the bookkeeping honest. It is
the engine, not the teacher: **you (the LLM) do the teaching, explaining, and
judging whether the learner passed; Telos Core does the math** — building the
prerequisite graph, locating the learner, picking what to learn next, and
deciding when to review.

The loop:

```
Outcome Spec → Knowledge Graph → adaptive Diagnosis → Learner State
  → Learning Frontier (ZPD) → teach / verify → FIRe credit propagation
  → FSRS spaced review → repeat
```

Four ideas it implements, each backed by a real algorithm:

- **Knowledge Space Theory** — a "knowledge state" is the set of mastered points
  closed under prerequisites; the *outer fringe* is what is learnable right now.
- **Adaptive diagnosis** (ALEKS-style) — ask the most uncertain point, propagate
  the answer up/down prerequisites, converge in ~25 questions instead of testing
  everything.
- **FIRe** — pass a point and credit flows *down* to its prerequisites; fail and
  penalty flows *up* to its dependents. Decays with graph distance.
- **FSRS-4.5** — each mastered point gets a spaced-repetition card (difficulty /
  stability / retrievability) so reviews land right before forgetting.

## When to reach for it

Use Telos when the task is "help someone get from where they are to a goal" and
ordering + retention matter:

- Tutoring or coaching toward a concrete outcome ("build a JWT-auth REST API").
- Onboarding / ramp plans where later topics depend on earlier ones.
- "What should I study next?" given what the learner already knows.
- Sequencing a curriculum so you never teach a topic before its prerequisites.
- Tracking long-term retention and surfacing what's due for review.

Skip it for one-off Q&A, or when there are no prerequisites / no goal to reach.

## How you fit in

| You (the LLM)                                   | Telos Core (this skill)                          |
| ----------------------------------------------- | ------------------------------------------------ |
| Write the Outcome Spec from the user's goal     | Reverse-derive / hold the **Knowledge Graph**    |
| Ask diagnostic questions, judge each answer     | Run **adaptive diagnosis**, build Learner State  |
| **Teach** the next point; **judge** pass/fail   | Compute the **learning frontier** (what's next)  |
| Decide the FSRS grade (again/hard/good/easy)    | Propagate mastery (**FIRe**) + schedule (**FSRS**) |

You never compute mastery or intervals by hand. You ask Telos *what's next*,
teach it, tell Telos *whether they passed*, and repeat.

## How to use it (CLI)

Everything runs through `scripts/telos.py`, pure Python standard library, **zero
dependencies**. It auto-locates `telos_core` from the monorepo (`../../core`);
if you've installed the package instead (`pip install -e <repo>/core`), that
just takes over and the path shim is ignored.

All commands speak JSON so you can pipe Learner State in and out.

### 1. See the knowledge graph

```bash
python3 scripts/telos.py graph
```

Prints the seed FastAPI/JWT graph (points + prerequisites + goal) as JSON. This
is the shape your own graphs should follow — see `references/data-standards.md`.

### 2. Watch the whole loop once

```bash
python3 scripts/telos.py demo
```

Runs diagnosis → frontier → teach/verify → spaced review end-to-end on the seed
graph and prints a readable trace. Good for understanding the moving parts.

### 3. Diagnose the learner

Give the answers to the diagnostic questions you asked, as a map of
`point_id -> known(bool)`. Telos uses them as the oracle and returns the full
Learner State (masteries + statuses + seeded review cards):

```bash
python3 scripts/telos.py diagnose \
  --answers '{"py":true,"http":true,"types":true}' \
  --out state.json
# or pipe the JSON on stdin:
echo '{"py":true,"http":true}' | python3 scripts/telos.py diagnose
```

Points you don't include default to "not known". `--out` saves the state so the
next commands can read it.

### 4. Ask what to learn / review next

```bash
python3 scripts/telos.py next --state state.json
```

Returns `learn` (the frontier, ranked by how much each point unlocks),
`recommended_next` (teach this one), and `review` (mastered points whose recall
has decayed below target). **Now you teach `recommended_next`** and quiz the
learner on it.

### 5. Record the outcome after you teach + verify

When you've taught a point and judged whether the learner passed, record it.
Telos applies FIRe credit/penalty and updates the FSRS card, writes the new
state back to the file, and prints the new progress:

```bash
# learner passed, comfortably (grade 3 = "good")
python3 scripts/telos.py record --state state.json --point jwt --correct true --grade 3

# learner failed → penalty propagates up to dependents
python3 scripts/telos.py record --state state.json --point jwt --correct false
```

`--grade` is the FSRS quality of recall: `1`=again `2`=hard `3`=good `4`=easy
(default `3`). Use `again` for fails or near-misses.

### The agent loop, in practice

```
1. From the user's goal, write an Outcome Spec (informs the graph).
2. telos.py graph        → see the points; ask the learner a quick yes/no per point.
3. telos.py diagnose --answers '{...}' --out state.json
4. telos.py next --state state.json     → take recommended_next.
5. TEACH recommended_next; quiz the learner; decide pass/fail + grade.
6. telos.py record --state state.json --point <id> --correct <bool> --grade <n>
7. Go to 4. Stop when progress.goals_reached is true; fold in `review` items as they come due.
```

Advance the `day` field in `state.json` (or via your own clock) so FSRS reviews
come due over time; `next` will then list them under `review`.

## Notes

- The seed graph is the FastAPI/JWT example. To use Telos on a different goal,
  build your own Knowledge Graph in the same JSON shape
  (`references/data-standards.md`) — the algorithms are domain-agnostic.
- Learner State is single-writer and versioned; treat `state.json` as the source
  of truth and let each `record` bump the version.
- For the library API behind the CLI (`TelosEngine`, models, FSRS), see
  `../core/README.md` and `references/data-standards.md`.
