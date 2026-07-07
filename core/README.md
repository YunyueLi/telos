# Telos Core

Telos 的**可移植学习引擎** —— 纯 Python 标准库实现，**零依赖**。

> 倒推目标 → 知识图谱 → 自适应诊断 → 学习者状态 → 学习前沿（KST/ZPD）→ 教学验证 → FIRe 学分传播 → FSRS 间隔复习 → 循环。

## 快速开始

```bash
cd core
python3 demo.py        # 端到端演示（FastAPI/JWT 例子，打印完整闭环）
python3 run_tests.py   # 零依赖测试跑器（13 个测试）
# 或用 pytest：
pip install -e ".[dev]" && pytest
```

## 模块

| 模块 | 作用 | 依据 |
| --- | --- | --- |
| `models.py` | 三个开放标准：Outcome Spec / Knowledge Graph / Learner State | — |
| `kst.py` | 知识空间理论：合法知识态、外缘（可学）/ 内缘（复习） | Knowledge Space Theory |
| `diagnosis.py` | 自适应诊断：选最不确定的点 + 前置/后继传播，~25 题定位 | ALEKS 式 |
| `fire.py` | 学分/惩罚传播：答对→学分下传前置，答错→惩罚上传后继 | FIRe |
| `fsrs.py` | 间隔复习调度：难度/稳定度/可提取度（DSR） | FSRS-4.5 |
| `frontier.py` | 学习前沿（ZPD）+ 到期复习计算 | ZPD |
| `engine.py` | 编排整个闭环 | — |
| `seed.py` | FastAPI/JWT 示例图谱（与 web demo 一致） | — |

## 三个开放标准

- **Outcome Spec** — 结构化的学习目标（倒推入口）
- **Knowledge Graph** — 带前置依赖的知识点 DAG
- **Learner State** — 单写者、可版本化的掌握状态（含 FSRS 卡片）

## 设计取舍

- **零依赖**：纯标准库，方便嵌进 agentskills.io `SKILL.md` 的 `scripts/`，或任何 agent 运行时。
- **算法可验证**：KST 外缘/内缘、FSRS 稳定度增长与遗忘曲线、FIRe 传播、诊断收敛都有测试。
- **与 web 一致**：`seed.py` 的图谱与前端 `web/lib/graph.ts` 同构，便于后续把引擎接到产品后端。

## 借鉴

Knowledge Space Theory（Doignon & Falmagne）、ALEKS 自适应评测、最近发展区（ZPD）、FIRe（credit down / penalty up）、FSRS（open-spaced-repetition）。

## License

Apache-2.0 for the standalone `core/` package. The repository-level Telos Community Edition license is AGPL-3.0.
