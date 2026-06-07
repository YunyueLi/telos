<div align="center">

# Telos

**说出目标，倒着学会它。**

*说出你想达成的结果 —— Telos 倒推出你真正需要的能力，只教你缺的，边教边验证。*

`开源` · `Apache-2.0` · `持续开发中`

[English](README.md) · **简体中文**

[落地页](https://yunyueli.github.io/telos/) · [在线 Demo](https://yunyueli.github.io/telos/app/)

</div>

---

## 这是什么

Telos 是一个 **「逆向设计 / 从结果倒推」** 的学习引擎。

> 说出你想达成的结果 → Telos 倒推出所需能力 → 拆成带前置依赖的图谱（DAG）
> → 诊断你当前掌握 → 计算你的**学习前沿（ZPD）** → 按你的水平教缺的
> → 客观验证掌握 → 循环。

第一个落点是 **编程 / 技术栈学习**：掌握度能用「跑通测试」客观验证，闭环最干净 —— 但引擎是按领域自适应的（见下）。

## 现在能用的

- **倒推任意目标**成技能 DAG（本地跑 `core/serve.py`，或用 Cloudflare Worker 给公开站 —— API key 永远在服务端，绝不进前端代码）。
- **专家级拆解**：节点是*可训练的能力（can-do）*，每个都带刻意练习 **drill** 与可量化 **benchmark**，不是泛泛的知识清单。（依据刻意练习、EPA/CEFR 胜任力框架。）
- **六大领域类**（A 陈述 · B 良构程序 · C 创造 · D 动作 · E 开放对抗 · F 习惯）驱动不同的诊断与复习策略。
- **自适应起点诊断**：诊断性干扰项选择题 + 信心（CBM 信心加权）折算进贝叶斯知识追踪（BKT），在前置依赖图上用信息增益选题 —— 取代粗糙的「会 / 不会」。
- **整页微课**：讲解 →「用你已会的来理解」类比 → 跟着做范例 → 检验题（结果回填引擎）；并推荐该领域最优质的公开课。
- **间隔复习（FSRS-4.5）**：学过的东西进入复习页；到期卡片按评分重排。
- **知识地图**：React Flow 画布 —— 桌面横向、手机纵向蜿蜒路径 —— 点任意节点看详情、开始学习。
- **游戏化 v1**：XP 由*真实学习信号*产生（掌握度增量、准时复习、目标点亮）+ 连胜，绝不挂钩在线时长。

## 三个开放标准

Telos 把整套范式拆成三份可独立使用、可互操作的数据标准：

| 标准 | 作用 |
| --- | --- |
| **Outcome Spec** | 把一句话目标结构化成可倒推的规格 |
| **Knowledge Graph** | 带前置依赖的「可训练能力」图谱（DAG） |
| **Learner State** | 单写者、可版本化的学习者掌握状态 |

## 目录结构

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `core/` | 学习引擎（Python，零依赖）：KST · BKT+CBM 诊断 · FIRe 学分传播 · FSRS 复习 · LLM 倒推 | ✅ 21 测试通过 |
| `web/` | 产品（Next.js + React + Tailwind + TypeScript，静态导出） | 🚧 活跃开发 |
| `workers/` | Cloudflare Worker LLM 代理（`/derive` · `/lesson` · `/probe`） | ✅ |
| `landing/` | 落地页（静态 HTML —— 设计基准） | ✅ |
| `docs/STRATEGY.md` | 调研支撑的路线图与决策 | ✅ |

## 快速开始

```bash
# 落地页 —— 浏览器直接打开
open landing/index.html

# 引擎（零依赖，纯标准库）
cd core
python3 run_tests.py      # 21 个测试
python3 demo.py           # 端到端演示
python3 derive.py "用 Rust 写一个高性能 HTTP 服务器"   # 倒推（需要 key，见 DERIVE.md）

# Web Demo
cd web
npm install --legacy-peer-deps
npm run dev               # http://localhost:3000
```

要在 **网页里倒推任意目标**，跑本地代理并把网页指过去：

```bash
cd core && python3 serve.py     # http://127.0.0.1:8787（从 core/.env 读你的 key）
# 另开一个终端：
cd web && NEXT_PUBLIC_TELOS_DERIVE_URL=http://127.0.0.1:8787/derive npm run dev
```

启用方式见 **[DERIVE.md](DERIVE.md)**（本地 key，或给公开站部署一个 Cloudflare Worker）。**切勿提交你的 API key。**

## 设计语言

纯黑白 + 暖灰纸感；衬线显赫（Fraunces）+ 无衬线正文（Inter）+ 等宽（JetBrains Mono）；手绘线性图标（带手抖滤镜）；编辑感版式。品牌看板娘是一位年轻女老师，黑白墨线、同一角色多姿态。

## 借鉴的研究与项目

逆向设计（Understanding by Design）、知识空间理论与 ALEKS 自适应测评、最近发展区（ZPD）、贝叶斯知识追踪（及其与 IRT 的关系）、信心加权评分（CBM）、FSRS 间隔复习、刻意练习（Ericsson）、EPA/CEFR/ACS 胜任力框架、情境判断题（SJT）、误解型干扰项（FCI）。完整出处见 [docs/STRATEGY.md](docs/STRATEGY.md)。

## License

[Apache-2.0](./LICENSE)
