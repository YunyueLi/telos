#!/usr/bin/env python3
"""Zero-dependency test runner (no pytest required): `python3 run_tests.py`."""
import sys
import traceback

sys.path.insert(0, ".")

from tests import (  # noqa: E402
    test_bkt,
    test_diagnosis,
    test_domain,
    test_engine,
    test_fire,
    test_fsrs,
    test_kst,
)

MODULES = [test_kst, test_fsrs, test_bkt, test_fire, test_diagnosis, test_engine, test_domain]


def main() -> int:
    passed = failed = 0
    for mod in MODULES:
        for name in sorted(dir(mod)):
            if not name.startswith("test_"):
                continue
            fn = getattr(mod, name)
            if not callable(fn):
                continue
            try:
                fn()
                passed += 1
                print(f"  PASS  {mod.__name__.split('.')[-1]}.{name}")
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"  FAIL  {mod.__name__.split('.')[-1]}.{name}: {exc}")
                traceback.print_exc()
    print(f"\n{passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
