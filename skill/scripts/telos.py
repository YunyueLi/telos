#!/usr/bin/env python3
"""Telos CLI — a zero-dependency wrapper around telos_core for Skill agents.

Locates telos_core from the monorepo (../../core). If you install the package
instead (`pip install -e <repo>/core`), the in-repo path is simply ignored.

Every subcommand is JSON-friendly so an agent can pipe state in and out:

    telos.py graph                       # the seed knowledge graph as JSON
    telos.py demo                        # full end-to-end loop, readable trace
    telos.py diagnose --answers '{...}'  # adaptive diagnosis -> LearnerState JSON
    telos.py next --state state.json     # learning frontier + due reviews
    telos.py record --state state.json --point jwt --correct true --grade 3

State serialization (see references/data-standards.md) round-trips the full
LearnerState: mastery, cards (FSRS), day, version, history.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# --- locate telos_core --------------------------------------------------------
# In-repo: telos_core lives at <repo>/core. This file is <repo>/skill/scripts/.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "core"))

try:
    from telos_core.engine import TelosEngine
    from telos_core.fsrs import Card, GOOD, interval, retrievability
    from telos_core.models import KnowledgeGraph, LearnerState
    from telos_core.seed import fastapi_jwt_graph, fastapi_jwt_spec, true_oracle
except ImportError as exc:  # pragma: no cover - defensive, guides the user
    sys.stderr.write(
        "error: could not import telos_core (%s).\n"
        "Run inside the monorepo (telos_core is auto-located at ../../core),\n"
        "or install it: pip install -e <repo>/core\n" % exc
    )
    raise SystemExit(2)


# --- LearnerState <-> JSON ----------------------------------------------------
def card_to_dict(card: Card) -> dict:
    return {
        "stability": card.stability,
        "difficulty": card.difficulty,
        "reps": card.reps,
        "lapses": card.lapses,
        "last_review_day": card.last_review_day,
        "state": card.state,
    }


def card_from_dict(d: dict) -> Card:
    return Card(
        stability=float(d.get("stability", 0.0)),
        difficulty=float(d.get("difficulty", 0.0)),
        reps=int(d.get("reps", 0)),
        lapses=int(d.get("lapses", 0)),
        last_review_day=int(d.get("last_review_day", 0)),
        state=str(d.get("state", "new")),
    )


def state_to_dict(state: LearnerState) -> dict:
    return {
        "mastery": {k: round(v, 6) for k, v in state.mastery.items()},
        "cards": {k: card_to_dict(c) for k, c in state.cards.items()},
        "day": state.day,
        "version": state.version,
        "history": list(state.history),
    }


def state_from_dict(d: dict) -> LearnerState:
    state = LearnerState()
    state.mastery = {k: float(v) for k, v in d.get("mastery", {}).items()}
    state.cards = {k: card_from_dict(c) for k, c in d.get("cards", {}).items()}
    state.day = int(d.get("day", 0))
    state.version = int(d.get("version", 0))
    state.history = list(d.get("history", []))
    return state


def load_state(path: str) -> LearnerState:
    with open(path, "r", encoding="utf-8") as f:
        return state_from_dict(json.load(f))


def save_state(path: str, state: LearnerState) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state_to_dict(state), f, ensure_ascii=False, indent=2)
        f.write("\n")


# --- graph <-> JSON -----------------------------------------------------------
def graph_to_dict(g: KnowledgeGraph) -> dict:
    return {
        "points": [
            {
                "id": p.id,
                "name": p.name,
                "prerequisites": list(p.prerequisites),
                "is_goal": p.is_goal,
                "minutes": p.minutes,
            }
            for p in (g[pid] for pid in g.topological_order())
        ],
        "goals": g.goals(),
        "topological_order": g.topological_order(),
    }


def emit(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def parse_bool(s) -> bool:
    if isinstance(s, bool):
        return s
    return str(s).strip().lower() in ("1", "true", "yes", "y", "t", "correct", "pass")


# --- subcommands --------------------------------------------------------------
def cmd_graph(args: argparse.Namespace) -> None:
    emit(graph_to_dict(fastapi_jwt_graph()))


def cmd_diagnose(args: argparse.Namespace) -> None:
    g = fastapi_jwt_graph()
    eng = TelosEngine(g)
    raw = args.answers
    if raw is None:
        raw = sys.stdin.read()
    answers = json.loads(raw)
    # oracle answers "known?" for a point; unknown points default to False.
    answer_map = {pid: parse_bool(v) for pid, v in answers.items()}
    oracle = lambda pid: answer_map.get(pid, False)  # noqa: E731
    state = eng.diagnose(oracle, budget=args.budget)
    out = state_to_dict(state)
    out["statuses"] = {pid: eng.status(state, pid).value for pid in g.topological_order()}
    out["progress"] = eng.progress(state)
    if args.out:
        save_state(args.out, state)
        out["saved_to"] = args.out
    emit(out)


def cmd_next(args: argparse.Namespace) -> None:
    g = fastapi_jwt_graph()
    eng = TelosEngine(g)
    state = load_state(args.state)
    rec = eng.recommend(state)
    learn = [
        {"id": pid, "name": g[pid].name, "unlock_score": score, "minutes": g[pid].minutes}
        for pid, score in rec["learn"]
    ]
    review = [
        {"id": pid, "name": g[pid].name, "retrievability": round(r, 4)}
        for pid, r in rec["review"]
    ]
    emit(
        {
            "day": state.day,
            "learn": learn,
            "recommended_next": learn[0] if learn else None,
            "review": review,
            "progress": eng.progress(state),
        }
    )


def cmd_record(args: argparse.Namespace) -> None:
    g = fastapi_jwt_graph()
    eng = TelosEngine(g)
    state = load_state(args.state)
    if args.point not in g:
        sys.stderr.write("error: unknown point %r (see `telos.py graph`)\n" % args.point)
        raise SystemExit(2)
    correct = parse_bool(args.correct)
    eng.record_result(state, args.point, correct=correct, grade=args.grade)
    save_state(args.state, state)
    card = state.cards.get(args.point)
    emit(
        {
            "point": args.point,
            "name": g[args.point].name,
            "correct": correct,
            "grade": args.grade,
            "mastery": round(state.get(args.point), 4),
            "status": eng.status(state, args.point).value,
            "card": card_to_dict(card) if card else None,
            "next_review_in_days": round(interval(card.stability), 2) if card else None,
            "progress": eng.progress(state),
            "saved_to": args.state,
        }
    )


def cmd_demo(args: argparse.Namespace) -> None:
    g = fastapi_jwt_graph()
    spec = fastapi_jwt_spec()
    eng = TelosEngine(g)

    def line(ch="-", n=64):
        print(ch * n)

    line("=")
    print("TELOS · backward-design learning loop (reverse-derived from the goal)")
    line("=")
    print("Goal: %s" % spec.goal)
    print(
        "Reverse-derived %d knowledge points; goal point(s): %s"
        % (len(g.points), ", ".join(g[i].name for i in g.goals()))
    )
    print("Topological order: " + " -> ".join(g[i].name for i in g.topological_order()))
    print()

    line()
    print("1) Adaptive diagnosis  (truly mastered: Python / types / HTTP)")
    line()
    state = eng.diagnose(true_oracle(), budget=25)
    for pid in g.topological_order():
        print(
            "   %-12s mastery %4.0f%%   %s"
            % (g[pid].name, state.get(pid) * 100, eng.status(state, pid).value)
        )

    line()
    print("2) Learning frontier (ZPD): prerequisites met, best to learn next")
    line()
    for pid, score in eng.frontier(state):
        print("   -> %-12s unlock score %d" % (g[pid].name, score))
    nxt = eng.recommend(state)["learn"][0][0]
    print("\n   Recommended next: %s (~%d min)" % (g[nxt].name, g[nxt].minutes))

    line()
    print("3) Learn & verify '%s'  (passing the test = objective mastery)" % g[nxt].name)
    line()
    eng.record_result(state, nxt, correct=True, grade=GOOD)
    print("   %s mastery -> %.0f%%   %s" % (g[nxt].name, state.get(nxt) * 100, eng.status(state, nxt).value))
    creditted = ", ".join("%s %.0f%%" % (g[a].name, state.get(a) * 100) for a in sorted(g.ancestors(nxt)))
    print("   FIRe credit down to prerequisites: %s" % creditted)
    newly = [g[p].name for p, _ in eng.frontier(state)]
    print("   New learning frontier: %s" % (", ".join(newly) if newly else "(none)"))

    line()
    print("4) Spaced-review schedule (FSRS)")
    line()
    for pid in g.topological_order():
        card = state.cards.get(pid)
        if card is None:
            continue
        print(
            "   %-12s stability %5.1fd   next review ~%4.1f days"
            % (g[pid].name, card.stability, interval(card.stability))
        )
    state.day = 30
    due = eng.recommend(state)["review"]
    due_str = ", ".join("%s(%.0f%%)" % (g[p].name, r * 100) for p, r in due) if due else "(none)"
    print("\n   Due for review on day 30: %s" % due_str)

    line("=")
    p = eng.progress(state)
    print("Progress %d/%d · goal reached: %s" % (p["mastered"], p["total"], "yes" if p["goals_reached"] else "no"))
    print("Loop: reverse-derive -> diagnose -> frontier -> teach/verify -> spaced review -> repeat")
    line("=")


# --- arg parsing --------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="telos.py",
        description="Telos backward-design learning engine CLI (zero-dependency).",
    )
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("graph", help="print the seed knowledge graph as JSON")
    sp.set_defaults(func=cmd_graph)

    sp = sub.add_parser("demo", help="run the full end-to-end loop (readable trace)")
    sp.set_defaults(func=cmd_demo)

    sp = sub.add_parser("diagnose", help="adaptive diagnosis from an answer map -> LearnerState JSON")
    sp.add_argument(
        "--answers",
        help='JSON map of point_id -> known(bool), e.g. \'{"py":true,"http":true}\'. '
        "Reads from stdin if omitted.",
    )
    sp.add_argument("--budget", type=int, default=25, help="max diagnostic questions (default 25)")
    sp.add_argument("--out", help="also write the resulting LearnerState to this JSON file")
    sp.set_defaults(func=cmd_diagnose)

    sp = sub.add_parser("next", help="print learning frontier + due reviews from a saved state")
    sp.add_argument("--state", required=True, help="path to a LearnerState JSON file")
    sp.set_defaults(func=cmd_next)

    sp = sub.add_parser("record", help="apply FIRe + FSRS for one teach/verify outcome, update state")
    sp.add_argument("--state", required=True, help="path to a LearnerState JSON file (written back)")
    sp.add_argument("--point", required=True, help="knowledge point id (see `telos.py graph`)")
    sp.add_argument("--correct", required=True, help="did the learner pass? true/false")
    sp.add_argument(
        "--grade",
        type=int,
        default=GOOD,
        choices=(1, 2, 3, 4),
        help="FSRS grade: 1=again 2=hard 3=good 4=easy (default 3)",
    )
    sp.set_defaults(func=cmd_record)

    return p


def main(argv=None) -> None:
    args = build_parser().parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
