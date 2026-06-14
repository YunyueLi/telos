# Telos × Greenroom 协同方案

> 两个产品是同一条价值链的两端：**Telos 把知识装进脑子（内化）**，**Greenroom 把脑子里的东西讲出来换 offer（外化）**。
> 同一个作者、几乎相同的设计语言、相同的 BYOK 代理架构、相同的"从结果倒推"哲学——所以"结合"主要是接线，不是重写。
> 本文是钉死的方向 + 4 个已细化到文件级的落地方案。Greenroom 仓库根：`~/Desktop/interview-prep/21_开源Greenroom/greenroom`。

## 七个机会（全量，勿忘）

1. **FSRS → 面试倒计时复习**（本文方案 #1）
2. **逐字稿写作铁律 → Telos 微课文风**（本文方案 #2）
3. **共享代理层 + 共享设计 token**（本文方案 #3）
4. **155 岗位库 ↔ Telos 能力图谱 / 模板店**（本文方案 #4）
5. 用 Telos 的计费栈（Supabase + KV 计量 + webhook + Pro）给 Greenroom 变现
6. BKT 给 Greenroom 建"讲熟度 / 岗位准备度"模型
7. "从想学到拿 offer"一条龙：两个产品共享一个"目标"对象

**两条红线**：① 别急着合并成一个 App（受众/节奏不同，长期泛学习 vs 事件驱动短期高动机）——做"共享地基 + 关键点打通"。② 开源边界：Greenroom 是 MIT 公开仓库，付费内容 / 真实候选人数据绝不进开源 repo；Telos 的付费图谱内容也不外泄。

---

## 方案 #1 — FSRS 接进 Greenroom：面试倒计时复习

**目标**：Greenroom 现在生成完逐字稿/经历卡就静止，没有"今天该过哪几张"的调度。面试有明确日期。把 Telos 的 FSRS-4.5 接到经历卡/逐字稿题/必考概念上 ⇒ "距面试还有 5 天，今日 3 张到期"。

**两边现状**
- Telos FSRS：`core/telos_core/fsrs.py`（~112 行，纯函数）+ TS 同构 `web/lib/telos/engine.ts:116-170`。
  - `Card{ stability, difficulty, reps, lapses, last_review_day, state:"new"|"review" }`
  - `review(card, grade, day, w=DEFAULT_W) -> Card`，grade 1-4（Again/Hard/Good/Easy）
  - `interval(stability, request_retention=0.9)`；`DEFAULT_W` = FSRS-4.5 的 17 权重
- Greenroom：单 HTML + vanilla JS。`parseBank`（经历卡，按**标题**取键，无稳定 ID）/ `parseScript`（题按 `n` 取键）/ `parseClaims`。复习状态**不存在**；localStorage 只有 `gr_*`（无 per-card 状态）。

**落地步骤**
1. **端口 FSRS 到 vanilla JS**：新建 `app/srs.js`（或内联进 `greenroom.html`），把 `fsrs.py` 的 `review/interval/Card` 逐行翻成 JS（与 `engine.ts:116-170` 完全同算法，~120 行，机械翻译）。加一个 1:1 校验脚本（同 grade 序列下 Python 与 JS 输出一致）。
2. **稳定卡 ID**（最小契约扩展，写进 `docs/workspace-spec.md`）：
   - 逐字稿题：天然键 `<job-slug>#<n>`（已稳定）。
   - 经历卡：键 `sb:<slug(标题)>`，允许用一行 `**卡号**：sb1` 显式覆盖（重命名不丢进度）。
   - 必考概念（来自 library 通识 / knowledge）：键 `kc:<role>:<concept-slug>`。
3. **复习状态存储**：localStorage `gr_srs = { [cardKey]: Card }`，配合云同步可后置。封装 `srsGrade(key, grade)` / `srsDue(now)`。
4. **倒计时模式（Greenroom 特有的 FSRS 改造）**：从 `jobs/<slug>/job.md` 时间线读面试日期 `D`。普通 FSRS 给"长期记忆最优间隔"，但面试要"到 D 当天全部新鲜"——所以加 `cramClamp(due, D)`：把任何 `due > D` 的卡夹到 `D-1`，且临近 D 提高 request_retention（0.9→0.95）。顶部显示"距面试 N 天 · 今日 X 张到期"。
5. **UI（控制台新增"复习"视图）**：抽卡 → 念一遍/回想 → 自评 Again/Hard/Good/Easy（沿用 Telos `/review` 的四档按钮与交互）。经历库/逐字稿卡片右上角加"新鲜度"角标（绿=熟、灰条=到期）。
6. **Phase 2（与 #6 衔接）**：模拟面试教练报告里"哪几题答得虚"自动折算成 grade 喂给 SRS（弱项 = Again/Hard），免手动自评。

**改的文件**：Greenroom `app/greenroom.html`（+新 `app/srs.js`）、`docs/workspace-spec.md`（卡 ID 契约）、`tools/embed-*.py` 不受影响。
**验收**：导入 demo workspace → "复习"视图按面试日期排出今日到期卡；自评后下次到期日变化符合 FSRS；重命名经历卡（带卡号）进度不丢。
**工作量**：中（~1-2 天）。FSRS 端口机械，主要工作在 UI 视图 + 倒计时夹紧 + ID 契约。
**风险**：面试场景偏"陈述性回忆"（你的数字/故事）属 domain A，FSRS 适用；但"临场表达流畅度"更像 D 类（靠重练，非遗忘曲线）——所以 SRS 只调度"该重过哪张"，不假装能给表达打分。

---

## 方案 #2 — 逐字稿写作铁律 → Telos 微课文风

**目标**：Telos `/lesson` 微课的讲解文本目前没有反 AI 腔约束，容易写出"不是…而是 / 恰恰 / 这正是"的塑料腔。Greenroom 有一套成熟的 `style-zh.md` 口语写作铁律，搬进来即提质。

**两边现状**
- Greenroom：`skills/interview-script/references/style-zh.md`（+ `style-en.md`）。核心可复用的是 **§II AI 味句式禁令** 与 **§III 升华尾巴 vs 犀利判断**。
- Telos `/lesson` prompt：`core/telos_core/llm.py:833-1029`（system 在 835-840）**且** `workers/derive.js:654-814` —— ⚠️ **两处 prompt 逐字重复**，改一处必须同步另一处（这也正是 #3 要解决的）。微课输出 JSON，承载文本的字段：`concept` / `explain.text` / `explain.analogy` / `worked.steps[].do|why` / `*.rationale` / `hints`。

**落地步骤**
1. **抽出"中文写作铁律"块**（从 style-zh §II+§III 浓缩成 prompt 可注入的一段）：
   ```
   【文风铁律·中文】写给人念/读，不是写论文：
   - 禁 AI 腔句式：不是…而是 / 而非 / 恰恰 / 这正是 / 不仅…而且 / 值得一提 / 综上 / 与其…不如 / 任何…都；用直接的正面陈述替代。
   - 禁"升华尾巴"：陈述事实后别加"这说明/这背后是/这意味着"的拔高；判断要短、可反驳、值得单独成句。
   - 破折号每段≤1；少用冒号堆砌。句长不齐，像沉稳的口语，不要排比成串。
   ```
2. **注入 `/lesson`**：把该块追加进 system prompt，并在"硬要求"里加一条"所有文本字段遵守文风铁律"。**同时改 `llm.py` 与 `derive.js` 两处**（或先做 #3 的 prompt 单源化再改一处）。
3. **可选扩散**：同一块注入 `/derive` 的 `desc/drill/benchmark` 与 `/probe` 的 `rationale`（这些也是给人读的文本）。
4. **验收**：对同一知识点生成微课，grep 禁用句式命中数 = 0；人读 explain 段落不出戏。

**改的文件**：Telos `core/telos_core/llm.py`、`workers/derive.js`（先 #3 则只改单源）。
**工作量**：小（~半天）。纯 prompt 改动，无结构变更。
**风险**：低。注意别让铁律压过"交互式微课"的本职（predict/worked/faded/retrieve 结构不变，只管文字风格）。

---

## 方案 #3 — 共享代理层 + 共享设计 token

**目标**：两个产品的 BYOK 代理做同一件事、设计 token 几乎一样。抽出共享单源，止住长期维护双份的成本，并顺手解决 #2 暴露的"prompt 两处重复"隐患。

### 3A 设计 token 单源
**现状对比**（共享-infra agent 实测）：

| token | Telos | Greenroom | 一致？ |
|---|---|---|---|
| `--paper` | `#F0EEE9` | `#F0EEE9` | ✓ |
| `--card` | `#FFFFFF` | `#FFFFFF` | ✓ |
| `--ink` | `#141310` | `#141310` | ✓ |
| `--ink-2` | `#56524A` | `#403B33` | ✗ |
| `--ink-3` | `#928E84` | `#8C8578` | ✗ |
| `--line`/`--line-soft` | 强 `#141310` + 软 `#E2DFD7` | 仅软 `#E2DFD7` | 部分 |
| `--hatch` | `#D5D1C7` | —（无） | Telos 独有 |
| `--live` / `--ok` | —（无） | `#B4452F` / `#3C6E47` | Greenroom 独有 |
| 字体 | Fraunces / Inter / JetBrains Mono | 同左 | ✓ |

**做法**：建一个权威 `tokens.css`（纯 `:root{}`）。
- **基色以 Telos 为准**（Telos 有 `docs/DESIGN.md` 全量规范，是更主动维护的设计源）：`--ink-2`/`--ink-3` 统一到 Telos 值，Greenroom 迁移。
- `--hatch`（学习中）、`--live`/`--ok`（状态色）作为**附加层**保留，各取所需。
- 分发：Telos 用 Tailwind v4 `@theme inline` 映射；Greenroom 单 HTML 直接 `@import` 或内联同一份。字体统一走 Google Fonts。
- **工作量**：小（~半天，主要是 Greenroom 改两个灰阶 + 抽文件）。

### 3B Prompt 单源 + 上游调用 helper
**现状**：`derive/lesson/probe` 的 system/user prompt 在 `core/telos_core/llm.py` 与 `workers/derive.js` **逐字重复**；上游调用（key 解析、base/model、deepseek 关 thinking、错误处理）三处各写一份（Telos serve、Telos worker、Greenroom serve）。

**做法**（务实，不强行合并服务器）：
1. **Prompt 单源**：把各 prompt 抽到 `core/telos_core/prompts/*.txt`，`llm.py` 读取；加一个 CI/脚本校验 `derive.js` 内嵌副本与 `.txt` 一致（JS 无法 import Python，退而求其次保证不漂移）。#2 的文风块也放这里，一处改全局生效。
2. **上游调用 helper**：抽 `chat_completion(messages, opts)`（含 deepseek thinking 开关、流式/非流式、错误归一）。Telos serve.py 与 Greenroom serve.py 都 import；Worker 保留独立实现（runtime 不同）。
3. **不做的事**：不合并两个 serve.py 成一个服务器——Greenroom 走 SSE 流式 + `/workspace/*` + `/api/setup`，Telos 走非流式 + JSON mode + 计量/计费，差异大于共性。**注意端口冲突**：两者默认都 `8787`，同机同跑需给一个改默认（Greenroom 硬编码 8787，Telos 有 `TELOS_PORT`）。

**改的文件**：新增 `core/telos_core/prompts/`、`core/telos_core/llm_shared.py`（或并入 `llm.py`）；Greenroom `serve.py` import 共享 helper；两仓库共享 `tokens.css`。
**工作量**：token 单源小；prompt 单源 + helper 中。
**风险**：跨仓库共享物的同步机制要想清楚（git submodule？复制 + 校验脚本？）。建议先用"复制 + 校验脚本"，别过早上 submodule。

---

## 方案 #4 — 155 岗位库 ↔ Telos 能力图谱 / 模板店

**目标**：Greenroom 每个岗位的"必考概念 + 追问链 + 基准线"本质上就是一张待学的能力图谱。打通两个方向：
- **(a) 岗位 → Telos 模板**："拿下 X 岗位"变成一个 Telos 学习项目（倒推图谱 + 诊断 + 教 + 复习）。
- **(b) Telos 倒推被岗位库 grounding**：`/derive` 带上真实岗位"必考/追问链/基准线"作上下文，图谱对齐真实面试水位而非泛泛而谈。

**两边现状**
- Greenroom `knowledge/`：`roles/<group>.md`（职能线）+ `<industry>-<role>.md`（深挖）。每条岗位 schema：`怎么想`(心智模型/基准线/战例/悬案/前沿) + `怎么考`(分水岭/失分/**必考**/黑话/高频题/**追问链**/定级/深度)。`必考` 可带 `[记忆/理解/应用/分析/创造]` Bloom 标签；`追问链` = `「题」→ ①[通用] ②[职能] ③[岗位]`，天然是递进/前置链。
- Telos `KnowledgePoint{ id, name, prerequisites, is_goal, tags, minutes, domain(A-F), desc, drill, benchmark, module, module_title }`（`core/telos_core/models.py:47-61`）。`TemplateMeta{ id, sku, title, goal, desc, price, url, free, tags, nodes, minutes, outline[] }`（`web/lib/telos/templates.ts:16-29`）。`fetchTemplatePoints(id)` → `POST /template`（鉴权 Pro 或已购 → KV `tpl:<id>` 取 `points[]`，`workers/derive.js:1005-1029`）。无独立 LearningPath 模型，模板即载体。

**映射表（岗位条目 → KnowledgePoint[]）**

| Greenroom 字段 | → Telos | 说明 |
|---|---|---|
| 每个`必考`概念 | 一个 `KnowledgePoint` 节点 | `name`=概念短语；`desc`=解释/会被追问点 |
| `必考` 的 `[Bloom]` 标签 | `domain` + 难度 | 记忆→A，应用/分析/创造→B/C |
| `追问链` ①→②→③ | `prerequisites` 链 | ①通用 是 ②职能 的前置，②是 ③岗位 的前置 |
| `基准线` | `benchmark` | 量化达标线直接搬 |
| `心智模型`/`黑话` | `drill`/`tags` | 怎么练 + 检索标签 |
| `高频题` | 种子给 `/probe` 检查题 | 真题转诊断题 |
| 岗位本身 | `is_goal` 终点 + `module_title` | "通过<岗位>面试"依赖全部必考 |

**落地步骤**
1. **写转换器** `tools/knowledge-to-graph.py`（放 Greenroom 仓库，knowledge 在那）：解析一条岗位 markdown → 校验合规的 `points[]` JSON（对齐 `KnowledgePoint`）。先支持有深挖文件的 3-5 个种子岗位（如 `ai-product-pm`）跑通端到端。
2. **(a) 灌模板**：用 Telos 现成的 `workers/seed-templates.sh` 把 `points[]` 写进 KV `tpl:<role-id>`；在 `templates.ts` 加 `TemplateMeta`（`title`=岗位、`goal`="拿下<岗位>面试"、`tags`、`nodes`、`outline`）。
   - ⚠️ **开源边界裁决**：Greenroom 知识是 MIT 公开内容，**不应**锁进 Telos 付费墙。这些"职业方向"模板在 Telos 设为**免费**（或仅 meta 公开、points 经 `/template` 免费下发），与"防白嫖"的私有母版区别对待。
3. **(b) grounding `/derive`**：给 `/derive` 加可选 `context` 入参，携带该岗位 `必考/追问链/基准线`，注入 user prompt，让倒推对齐真实水位。改动小（单 prompt + 入参）。
4. **批量**：Phase 1 跑通 3-5 个；Phase 2 扩到 155（转换器稳定后批处理）。

**改的文件**：Greenroom 新增 `tools/knowledge-to-graph.py`；Telos `web/lib/telos/templates.ts`（+meta）、`workers/seed-templates.sh`/KV、`core/telos_core/llm.py` + `workers/derive.js`（`/derive` context 入参，受 #3 prompt 单源约束）。
**工作量**：中-大（~2-3 天）。难点是 markdown 解析的鲁棒性与"追问链→前置边"的映射质量。
**风险**：① 自动映射质量——先人工校 3-5 个种子，定型再批量。② 严守开源边界（步骤 2 的裁决）。

---

## 建议顺序

1. **#2 文风铁律 + #3A token 单源**（各半天，立刻提质，零结构风险）
2. **#1 FSRS → 面试复习**（用户价值最直观，验证"Telos 引擎能服务 Greenroom 场景"）
3. **#3B prompt/helper 单源**（在 #2 暴露重复后顺势做，给 #4 铺路）
4. **#4 岗位库 → 图谱**（最大、最需设计，放最后）

机会 5/6/7 留作中远期（计费栈复用 → Greenroom 变现；BKT 讲熟度；一条龙叙事）。
