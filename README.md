<div align="center">

# Telos

**从结果倒推，学会任何事**

*Say the outcome. Telos works backward to what you must learn, and teaches only the gaps.*

`开源` · `Apache-2.0` · `Work in Progress`

**在线访问** · [落地页](https://yunyueli.github.io/telos/) · [交互 Demo](https://yunyueli.github.io/telos/app/)

</div>

---

## 在线访问

| | 链接 |
| --- | --- |
| 落地页 | https://yunyueli.github.io/telos/ |
| 交互 Demo（目标 → 地图 → 学习） | https://yunyueli.github.io/telos/app/ |

> Demo 用预置的「FastAPI + JWT」示例图谱演示完整流程；接入真实 LLM 对任意目标倒推是下一步。

## 这是什么

Telos 是一个 **「逆向设计 / 从结果倒推」** 的学习框架与 Agent。

> 你说出想达成的结果 → Telos 倒推出所需技能 → 拆成带前置依赖的知识点图谱
> → 诊断你当前的掌握 → 计算你的「学习前沿（ZPD）」→ 生成个性化路径
> → 按你的水平教学 → 跑测试客观验证掌握 → 循环。

第一个落点（beachhead）是 **编程 / 技术栈学习**：掌握度可以用「跑通测试」客观验证，闭环最干净。

## 三个开放标准

Telos 把整套范式拆成三份可独立使用、可互操作的数据标准：

| 标准 | 作用 |
| --- | --- |
| **Outcome Spec** | 把一句话目标结构化成可倒推的规格 |
| **Knowledge Graph** | 带前置依赖的知识点图谱（DAG） |
| **Learner State** | 单写者、可版本化的学习者掌握状态 |

## 形态

- **telos-core** — 可移植的核心引擎（Python）：知识空间理论（KST）、自适应诊断、知识追踪（BKT）、FSRS 间隔复习、FIRe 学分传播
- **SKILL.md 适配器** — 兼容 agentskills.io / openclaw 生态，让任意支持 Skill 的 Agent 都能跑 Telos
- **web** — 产品 Demo（Next.js + Tailwind）
- **landing** — 落地页（静态）

## 目录结构

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `landing/` | 落地页（静态 HTML） | ✅ |
| `web/` | 产品 Demo（Next.js + Tailwind + TypeScript） | 🚧 进行中 |
| `core/` | 学习引擎（Python） | 📋 规划中 |
| `skill/` | SKILL.md 适配器 | 📋 规划中 |

## 快速开始

```bash
# 落地页：直接用浏览器打开
open landing/index.html

# Web Demo
cd web
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000
```

## 设计语言

纯黑白 + 暖灰纸感；衬线显赫（Fraunces）+ 无衬线正文（Inter）+ 等宽（JetBrains Mono）；手绘线性图标；编辑感版式。品牌看板娘为一位年轻女老师，黑白二次元墨线、同一角色多姿态。

## 借鉴的研究与项目

逆向设计（Understanding by Design）、知识空间理论（Knowledge Space Theory）、ALEKS 自适应诊断、最近发展区 / 学习前沿（ZPD）、知识追踪（BKT / DKT）、FSRS 间隔复习，以及 GenMentor、IntelliCode、OATutor 等开源工作。

## License

[Apache-2.0](./LICENSE)
