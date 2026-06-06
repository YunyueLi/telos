# Telos data standards

Telos is built around three small, open JSON shapes. They are portable: any
agent or backend can produce/consume them, and the engine is domain-agnostic —
swap the graph and everything else (diagnosis, frontier, FIRe, FSRS) just works.

1. **Outcome Spec** — the structured goal you reverse-derive from.
2. **Knowledge Graph** — the prerequisite DAG of knowledge points.
3. **Learner State** — the single-writer, versioned record of what's mastered.

All field types below are JSON types. Defaults match `telos_core` dataclasses.

---

## 1. Outcome Spec

A structured learning goal — the entry point for backward design. Authored by
the LLM from the user's request; it informs which points become goals in the
graph.

```json
{
  "goal": "用 FastAPI 写一个带 JWT 鉴权的 REST API，并部署上线",
  "target_ids": ["deploy"],
  "deadline_days": 14,
  "bar": "能独立做出"
}
```

| Field           | Type             | Req | Default      | Meaning                                                        |
| --------------- | ---------------- | --- | ------------ | -------------------------------------------------------------- |
| `goal`          | string           | yes | —            | Natural-language outcome the learner wants.                    |
| `target_ids`    | array of string  | no  | `[]`         | IDs of the graph points that *are* the goal (the DAG sinks).   |
| `deadline_days` | integer \| null  | no  | `null`       | Days available; used for pacing. `null` = no deadline.         |
| `bar`           | string           | no  | `"能独立做出"` | Mastery bar in words ("can do it unaided").                    |

---

## 2. Knowledge Graph

A prerequisite DAG. Each point lists the points that must be mastered before it.
The graph must be acyclic (the engine raises on a cycle) and every prerequisite
must reference an existing id.

This is exactly what `telos.py graph` prints:

```json
{
  "points": [
    { "id": "py",     "name": "Python 基础",  "prerequisites": [],                "is_goal": false, "minutes": 30 },
    { "id": "http",   "name": "HTTP 基础",    "prerequisites": ["py"],            "is_goal": false, "minutes": 25 },
    { "id": "types",  "name": "函数与类型",    "prerequisites": ["py"],            "is_goal": false, "minutes": 25 },
    { "id": "jwt",    "name": "JWT 原理",     "prerequisites": ["http", "types"], "is_goal": false, "minutes": 25 },
    { "id": "rest",   "name": "REST 设计",    "prerequisites": ["http"],          "is_goal": false, "minutes": 30 },
    { "id": "route",  "name": "FastAPI 路由", "prerequisites": ["jwt"],           "is_goal": false, "minutes": 30 },
    { "id": "mw",     "name": "鉴权中间件",    "prerequisites": ["jwt", "rest"],   "is_goal": false, "minutes": 35 },
    { "id": "deploy", "name": "部署上线",      "prerequisites": ["route", "mw"],   "is_goal": true,  "minutes": 40 }
  ],
  "goals": ["deploy"],
  "topological_order": ["py", "http", "types", "rest", "jwt", "route", "mw", "deploy"]
}
```

### Point object

| Field           | Type            | Req | Default | Meaning                                                  |
| --------------- | --------------- | --- | ------- | -------------------------------------------------------- |
| `id`            | string          | yes | —       | Stable unique key; used everywhere else.                 |
| `name`          | string          | yes | —       | Human-readable label.                                    |
| `prerequisites` | array of string | no  | `[]`    | IDs that must be mastered first. Defines the edges.      |
| `is_goal`       | boolean         | no  | `false` | Whether this point is a target outcome (a DAG sink).     |
| `minutes`       | integer         | no  | `25`    | Estimated time-to-learn; used for pacing hints.          |
| `tags`          | array of string | no  | `[]`    | Optional free-form labels (carried on the model).        |

### Top-level (derived, output-only)

| Field               | Type            | Meaning                                                 |
| ------------------- | --------------- | ------------------------------------------------------- |
| `goals`             | array of string | All ids where `is_goal` is true.                        |
| `topological_order` | array of string | A prerequisite-respecting ordering (no edge points back). |

> To author your own graph, you only need `points` (with `id`, `name`,
> `prerequisites`, `is_goal`). `goals` and `topological_order` are computed.

---

## 3. Learner State

Single-writer, versioned. Treat one JSON file as the source of truth; every
`diagnose`/`record` bumps `version` and appends to `history`. This is what
`telos.py diagnose --out` writes and what `next` / `record` read.

```json
{
  "mastery": {
    "py": 0.989145,
    "types": 0.818182,
    "http": 0.818182,
    "jwt": 0.111111,
    "rest": 0.111111,
    "route": 0.015385,
    "mw": 0.015385,
    "deploy": 0.001949
  },
  "cards": {
    "py":    { "stability": 2.4, "difficulty": 4.93, "reps": 1, "lapses": 0, "last_review_day": 0, "state": "review" },
    "http":  { "stability": 2.4, "difficulty": 4.93, "reps": 1, "lapses": 0, "last_review_day": 0, "state": "review" },
    "types": { "stability": 2.4, "difficulty": 4.93, "reps": 1, "lapses": 0, "last_review_day": 0, "state": "review" }
  },
  "day": 0,
  "version": 1,
  "history": [
    { "v": 1, "day": 0, "event": "diagnosis", "questions": 6 }
  ]
}
```

### Top-level

| Field     | Type                       | Default | Meaning                                                       |
| --------- | -------------------------- | ------- | ------------------------------------------------------------- |
| `mastery` | object: id → number `[0,1]`| `{}`    | Belief that each point is mastered. ≥ 0.8 = mastered.         |
| `cards`   | object: id → Card          | `{}`    | FSRS spaced-repetition card per point that's in the cycle.    |
| `day`     | integer                    | `0`     | Current day index (your clock). Drives when reviews come due. |
| `version` | integer                    | `0`     | Monotonic write counter (single-writer guard).                |
| `history` | array of object            | `[]`    | Append-only audit log; each entry has `v`, `day`, `event`, …. |

### Card object (FSRS-4.5)

| Field             | Type    | Default   | Meaning                                                       |
| ----------------- | ------- | --------- | ------------------------------------------------------------- |
| `stability`       | number  | `0.0`     | S — days for recall probability to fall to ~90%.              |
| `difficulty`      | number  | `0.0`     | D — intrinsic difficulty, 1..10.                              |
| `reps`            | integer | `0`       | Times reviewed.                                               |
| `lapses`          | integer | `0`       | Times graded "again" (forgotten).                             |
| `last_review_day` | integer | `0`       | `day` of the most recent review.                              |
| `state`           | string  | `"new"`   | `"new"` before first review, then `"review"`.                 |

Retrievability is **not** stored: it's derived on demand from `stability` and
`day - last_review_day`. A point is **due** when its retrievability has dropped
below the target retention (0.9). `next` reports due cards under `review`.

### Status (derived, from mastery + graph)

`diagnose` and `record` also emit a per-point `status`, computed from mastery
and prerequisites — not stored on the state:

| Status      | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| `locked`    | A prerequisite is not yet mastered — can't learn it yet.     |
| `learnable` | Outer fringe: prerequisites met, ready to start (ZPD).       |
| `learning`  | In progress (some mastery, below the bar).                   |
| `mastered`  | Mastery ≥ threshold (default 0.8).                           |

---

## Invariants & conventions

- **Mastery threshold** defaults to `0.8`; "mastered" everywhere means `≥ 0.8`.
- **Knowledge state validity** (KST): the set of mastered points should be
  downward-closed under prerequisites. Diagnosis and FIRe maintain this.
- **FIRe**: a correct result credits prerequisites *down* (decaying with
  distance); an incorrect result penalizes dependents *up*.
- **Single writer**: only one process should mutate a given Learner State;
  `version` increments on every change so you can detect lost updates.
- **Time**: advance `day` with your own clock; FSRS uses `day - last_review_day`
  to decide what's due.
