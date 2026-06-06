#!/usr/bin/env python3
"""倒推：任意目标 → 知识图谱（需配置 LLM key，见 core/.env.example）。

用法：
    python3 derive.py "用 Rust 写一个高性能 HTTP 服务器"
"""
import sys

from telos_core import llm
from telos_core.engine import TelosEngine


def main() -> int:
    goal = " ".join(sys.argv[1:]).strip() or "用 FastAPI 写一个带 JWT 鉴权的 REST API，并部署上线"
    if not llm.available():
        print("✗ 未配置 LLM API key。三步搞定：")
        print("  1) 复制 core/.env.example 为 core/.env")
        print("  2) 把 TELOS_LLM_API_KEY 改成你自己的新 key（旧 key 若泄露请先作废）")
        print(f'  3) 重新运行：python3 derive.py "{goal}"')
        return 1
    print(f"目标：{goal}\n倒推中…\n")
    try:
        g = llm.derive_graph(goal)
    except Exception as e:  # noqa: BLE001
        print("✗", e)
        return 1
    print(f"倒推出 {len(g.points)} 个知识点（拓扑序）：")
    for pid in g.topological_order():
        pre = [g[p].name for p in g.prerequisites(pid)]
        mark = " ★目标" if g[pid].is_goal else ""
        tail = f"  ← {', '.join(pre)}" if pre else ""
        print(f"  - {g[pid].name}{mark}{tail}")
    TelosEngine(g)  # validates the graph is usable by the engine
    print(f"\n目标点：{', '.join(g[i].name for i in g.goals())}")
    print("（这张图可直接喂给诊断 / 学习前沿 / FSRS 复习的同一套引擎）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
