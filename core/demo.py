#!/usr/bin/env python3
"""End-to-end demo of the Telos learning engine — run: `python3 demo.py`."""
from telos_core import kst
from telos_core.engine import TelosEngine
from telos_core.fsrs import GOOD, interval
from telos_core.seed import fastapi_jwt_graph, fastapi_jwt_spec, true_oracle


def line(ch="─", n=64):
    print(ch * n)


def main():
    g = fastapi_jwt_graph()
    spec = fastapi_jwt_spec()
    eng = TelosEngine(g)

    line("═")
    print("TELOS · 学习引擎演示（从结果倒推）")
    line("═")
    print(f"目标：{spec.goal}")
    print(f"倒推出 {len(g.points)} 个知识点，目标点：{', '.join(g[i].name for i in g.goals())}")
    print("拓扑顺序：" + " → ".join(g[i].name for i in g.topological_order()))
    print()

    line()
    print("① 自适应诊断  （真实掌握：Python 基础 / 函数与类型 / HTTP 基础）")
    line()
    state = eng.diagnose(true_oracle(), budget=25)
    for pid in g.topological_order():
        print(f"   {g[pid].name:<12} 掌握度 {state.get(pid):4.0%}   {eng.status(state, pid).value}")

    line()
    print("② 学习前沿（ZPD）：前置已全部掌握、最该学的")
    line()
    for pid, score in eng.frontier(state):
        print(f"   → {g[pid].name:<12} 解锁力 {score}")
    nxt = eng.recommend(state)["learn"][0][0]
    print(f"\n   推荐下一步：{g[nxt].name}（约 {g[nxt].minutes} 分钟）")

    line()
    print(f"③ 学习并验证「{g[nxt].name}」  （跑通测试 = 客观确认掌握）")
    line()
    eng.record_result(state, nxt, correct=True, grade=GOOD)
    print(f"   {g[nxt].name} 掌握度 → {state.get(nxt):.0%}   {eng.status(state, nxt).value}")
    creditted = ", ".join(f"{g[a].name} {state.get(a):.0%}" for a in sorted(g.ancestors(nxt)))
    print(f"   FIRe 学分下传到前置：{creditted}")
    newly = [g[p].name for p, _ in eng.frontier(state)]
    print(f"   现在的学习前沿：{', '.join(newly) if newly else '（无）'}")

    line()
    print("④ 间隔复习排程（FSRS）")
    line()
    for pid in g.topological_order():
        card = state.cards.get(pid)
        if card is None:
            continue
        print(f"   {g[pid].name:<12} 稳定度 {card.stability:5.1f}d   下次复习约 {interval(card.stability):4.1f} 天后")
    state.day = 30
    due = eng.recommend(state)["review"]
    due_str = ", ".join(f"{g[p].name}({r:.0%})" for p, r in due) if due else "（无）"
    print(f"\n   第 30 天待复习：{due_str}")

    line("═")
    p = eng.progress(state)
    print(f"进度 {p['mastered']}/{p['total']} · 目标达成：{'是' if p['goals_reached'] else '否'}")
    print("闭环：倒推 → 诊断 → 学习前沿 → 教学验证 → 间隔复习 → 循环")
    line("═")


if __name__ == "__main__":
    main()
