# Telos 战略与路线图

> 本文是三个方向的调研综合 + **明确决策** + 分阶段路线图。
> 调研方法:三路并行的深度 web search,交叉核验头部学术成果与开源/产品实践,关键结论附出处。
> 三个方向:① 学习领域分类 ② 学习地图画布 ③ 游戏化排位激励。
>
> 当前已落地(2026-06):零依赖 Python 引擎(BKT 诊断 + 信息增益 + KST 学习前沿 + FIRe + FSRS-4.5)、
> TS 同构引擎、网页 Demo(诊断/地图/复习/账号)、**LLM 倒推任意目标**(本地 `serve.py` + 生产 Cloudflare Worker)。
> 下面是把它推向"通用学习引擎 + 社区"的三块拼图。

---

## 一、学习领域分类:按"学习机制"而非"学科"切

**决策:采用 6 大类(按底层学习机制),目标(OutcomeSpec)可混合多类,引擎按节点的 `domain` 自适应选诊断/复习策略。** 不做"数学/英语/物理"式的学科分类——那是表象;真正决定"怎么学、怎么测、怎么复习"的是知识类型(陈述性/程序性)、领域结构(良构/病构)、Bloom 三域(认知/情感/动作)这三个维度的叠加。

| # | 大类 | 典型例子 | 核心机制 | 倒推图形态 | 诊断(BKT) | 复习(FSRS) |
|---|---|---|---|---|---|---|
| **A** | 陈述性知识体 | 外语词汇、术语、法条、解剖 | 记忆 + 提取练习 | 网状/弱层级 | **最适用**,`p_g` 按题型调 | **主场** |
| **B** | 良构程序性/算法 | 数学解题、编程、配平 | 陈述→程序化(Fitts-Posner/ACT-R) | **强层级 DAG**(当前主打) | 适用,需"分步对错" | 仅概念/公式;流畅度靠重做题 |
| **C** | 病构/创造性 | 写作、设计、创业、研究 | Bloom 高层 Create;无唯一解 | 网状 + 螺旋(软依赖) | **降级**为前置探测;能力走 rubric | 仅脚手架知识 |
| **D** | 闭环动作 | 乐器、书法、投篮、缝合 | Bloom 动作域;表现性评估 | 线性/层级 | 不能纯回忆测,改"表现质量分" | 不用 FSRS,但 spacing 成立(调度练习 session) |
| **E** | 开放/对抗性表现 | 电竞、格斗、辩论、急诊 | 动作+认知+直觉(Dreyfus 专家级) | 网状 + 反馈环(随版本/对手变) | 几乎不可用,需对局数据/Elo | 仅知识层(地图/套路) |
| **F** | 情感/社会/习惯 | 习惯养成、情绪调节、领导力 | Bloom 情感域;长期一致性 | 螺旋/累积(节点是行为) | 不适用,追踪频率/坚持 | 换成打卡/streak 提醒 |

**对引擎的具体改动(已定位到文件):**
- `core/telos_core/models.py`:`KnowledgePoint` 增 `domain: DomainClass`(A–F);`prerequisites` 区分 hard/soft(C/E/F 用软前置,不强制锁);放宽对 C/E/F 的纯 DAG 约束(允许螺旋复现同一能力)。
- `core/telos_core/bkt.py`:`BKTParams` 按类查表(A:`p_g`=1/选项数;B:`p_s`↓;D/E:`p_g`≈0)。
- `core/telos_core/engine.py`:`diagnose(oracle)` 的 oracle 语义按类切换(binary / performance / rubric / behavior);FSRS 写卡按类门控。
- `core/telos_core/frontier.py`:前沿定义按类(A/B=前置已掌握的下一节点;E/F=略高于当前表现分布的挑战)。

**学术红线:** BKT 原论文(Corbett & Anderson 1995)标题即 *"Modeling the acquisition of **procedural** knowledge"*——它本就是为 B 类设计的;套到 C/E/F 是越界,会系统性失真,故降级使用。

**关键依据:** Bloom 三域 + Anderson-Krathwohl 修订(2001)、Fitts-Posner(1967)、ACT-R proceduralization、Dreyfus 五阶段(1980)、Jonassen 良构/病构(1997)、Ericsson 刻意练习需"well-defined domains"、Krashen 二语习得、Vygotsky ZPD(= Telos 的"学习前沿")、O*NET 能力四分(认知/心理动作/身体/感官)。

---

## 二、学习地图画布:React Flow + d3-dag(我的定夺)

用户让我定夺,**结论:主选 React Flow(`@xyflow/react`,MIT)+ d3-dag 布局,客户端 `ssr:false` 挂载,可直接跑在 GitHub Pages 静态导出上。** 理由是它唯一同时满足:开源 License 干净 + React 原生 + 静态站友好 + 无限缩放平移 + 多形态可延展。

**为什么不是 tldraw / 其它:**
- **tldraw**:技术最强,但 source-available(非 OSI 开源)、非商用强制水印、商用需 license key,**与干净的 Apache-2.0 开源冲突**,排除为主方案。
- **Excalidraw**:MIT,但是"手绘白板"范式,改造成结构化知识图成本高。
- **Sigma.js(WebGL,MIT,10 万节点)**:留作"超大网状知识图谱"的**性能兜底渲染后端**,不作主画布(节点退化为圆点,富交互弱)。
- **自研 Konva/Pixi**:可控但工程量最大,现阶段不投入。

**核心架构:一套数据 + 可插拔布局/渲染器(data-driven layouts)。** 借鉴 Obsidian 的 **JSON Canvas**(MIT,nodes+edges 两数组,未知字段被忽略 → 天然可扩展/可互操作),扩展掌握度等学习语义。一套底层 `Graph` 数据,驱动 6 种领域形态:

| 模板 | 适用 | 布局 |
|---|---|---|
| 线性路径型 | 语言/考证 | d3-dag(Zherebko) |
| 层级 DAG 依赖型 | 数学/CS(当前) | **d3-dag(默认)/ dagre** |
| 网状关联型 | 历史/哲学 | d3-force / ForceAtlas2 |
| 时间线型 | 历史/项目 | 自定义(x=f(date)) |
| 螺旋进阶型 | 技能螺旋上升 | 极坐标布局 |
| 自由白板型 | 头脑风暴 | 持久化 x/y,不自动布局 |

布局做成纯函数 `layout(graph, opts) → positions`,React Flow 只消费坐标(这正是官方推荐模式)。**当前 `web/lib/telos/layout.ts` 的零依赖分层布局就是这套接口的雏形**——上 React Flow 时把布局换成 d3-dag、渲染层照样消费即可。

**迁移路径(分阶段,每阶段独立可验证、不破坏静态导出):**
`P0` 数据抽象(现状 DAG → 统一 `{nodes,edges}` + 学习语义) → `P1` React Flow 等价替换(dagre 复刻现布局) → `P2` 开无限画布(缩放/平移/fitView/minimap + 拖拽持久化 x/y) → `P3` 布局可插拔 + 多模板 → `P4` 超大图切 Sigma.js WebGL 兜底 → `P5`(远期)协作(Yjs + 同步服务,脱离纯静态)。

**关键依据:** React Flow MIT / SSR-SSG 文档、d3-dag(MIT,质量优于 dagre 且体积小)、ELK/elkjs(工业级,放 Web Worker)、JSON Canvas(MIT)、Sugiyama 分层布局(1981)、Novak 概念图、Holten 边捆绑(2006/2009)、semantic zoom / focus+context、Web 图库渲染实测(WebGL>Canvas>SVG)。

---

## 三、游戏化排位:复刻多邻国留存引擎,但燃料换成"真实学习信号"

**决策:照搬多邻国已被数据验证的留存机制(XP 统一货币、同水平 30 人周榜联赛、连胜+冻结、好友协作),但所有计分的"燃料"从"在线时长"换成四类难以伪造的真实学习信号——BKT 掌握度增量、FSRS 准时按质复习、倒推目标点亮、诊断校准。** 并严守 9 条"不挤出内在动机"的红线。

**XP 公式(核心创新——挂钩学到的东西,不是花的时间):**
```
XP = w_mastery · ΔP(L)掌握度净增      (已达 0.95 的点 Δ→0,重复刷题不给分)
   + w_review  · 复习质量 · 准时度     (只有 FSRS 判定"到期"的复习才满额)
   + w_goal    · 目标节点点亮(一次性大额)
   + w_calib   · 诊断校准提升(Brier 分,奖励"自知之明")
```
同一知识点当日 XP 指数衰减(`0.6^(n-1)`)防刷。

**段位/联赛:** 周榜每组 30 人,按 BKT 能力分组(Elo 思想,保证"赢得到");7 段起步(Iron→Master,可社区改名);晋级区随段位收紧;**落后者保护**:底部不公开点名、匹配略弱对手、一键切"仅个人进度"。

**连胜:** 保签门槛 = 完成当日**到期**复习(本就该做的事),**不强制新增学习量**;有冻结/补签(宝石购买,每月上限);断裂只回落里程碑不归零。

**9 条红线(不可逾越,基于 Deci/Koestner/Ryan 1999 的 128 实验元分析 + 排行榜负面证据):**
1. 学习评分诚实性 > 一切 XP(`Again` 不罚、谎报无收益,否则污染 FSRS 信号)。
2. XP 是进度副产品不是诱饵;优先**语言化胜任反馈**而非数字轰炸(有形预期奖励才挤出内在动机,言语反馈不会)。
3. 竞争完全可关闭。4. 绝不公开羞辱落后者(只用相对/邻居榜)。5. 连胜不绑架核心学习。
6. 黑帽机制(稀缺/损失/比较)总量受限、不渗入核心学习回路。7. 不默认引入金钱损失式承诺。
8. 有效 XP 服务端可依 BKT/FSRS 重算校验,异常静默移出榜单(不公开处罚)。9. 新手期弱化硬目标(利探索)。

**可扩展架构(社区可贡献新玩法而不改核心):** `不可变学习事件 → 声明式积分规则(可插拔)→ 派生状态(段位/成就/榜单)`。核心只发射真实学习事件并持久化;XP/段位/成就/任务全是订阅事件的规则插件——这是"可玩性无限"的工程落点。

**关键依据:** SDT(Deci & Ryan)、过度合理化效应(Deci/Koestner/Ryan 1999)、Octalysis(Yu-kai Chou)、Fogg B=MAP、心流(Csikszentmihalyi)、目标设定(Locke & Latham)、教育游戏化元分析(Sailer & Homner 2020,学习成就 g≈0.49)、排行榜负面证据(arXiv 2305.08346 等)、多邻国增长复盘(前 CPO Jorge Mazal:联赛上线学习时长 +17%、7+ 天连胜用户占比近 3 倍)。
> 已剔除网络流传的伪造统计(Beeminder "3.2×"、Strava "3× kudos"),只保留可追溯到同行评审/一手来源的数据。

---

## 四、社区共建:领域学习方式的上传/复用

贯穿三块:用户可上传"某领域怎么学",供他人 fork/参考。**数据模型借鉴 roadmap.sh(社区图谱+专家审核)、Open Syllabus(Syllabi/Works/Matches 三实体)、AnkiHub(协作版本)、AnkiWeb(评分)。**

核心实体 `LearningPath`:`{title, domain_goal, domain_class(A–F), subject_tags, graph(节点+hard/soft边), nodes[].resources, assessment_mode, engine_overrides, author, license(默认 CC-BY), version, forked_from, stats, status}`。

**治理:** 双信号评分(显式 👍/👎 + **隐式:真实学完率 & 学完后引擎记录的掌握度净增**)——隐式信号是 Telos 独有优势(有真引擎遥测),正好补上 Anki 共享生态"点赞高但学不会"的漏洞;三级状态(draft → community → expert-reviewed);可 fork + 版本 + 强制署名;C/E/F 类路径显式标注"经验性/有争议",不冒充唯一正确答案。

---

## 五、整合路线图

| 阶段 | 主题 | 内容 | 状态 |
|---|---|---|---|
| **0** | 引擎 + Demo | 论文级引擎(BKT/KST/FIRe/FSRS)、网页四屏、账号、**LLM 倒推任意目标**(serve.py + Worker) | ✅ 已完成 |
| **1** | 领域分类 v1 | `domain` 字段 + A/B 类的 `BKTParams` 查表 + FSRS 门控(最快见效:当前数学/编程场景属 B) | 下一步 |
| **2** | 画布 P1–P2 | React Flow 等价替换现地图 + 无限画布(缩放/平移/拖拽持久化) | 下一步 |
| **3** | 游戏化 v1 | 真实信号 XP + 连胜(保签=完成到期复习)+ 个人进度;先不上排行榜 | 中期 |
| **4** | 社区 v1 | `LearningPath` 上传/fork + 双信号评分 + 三级审核 | 中期 |
| **5** | 多形态 + 段位 | 画布 P3 多布局模板;按类扩 C/D 诊断(rubric/表现分);联赛/好友(带落后者保护) | 中期 |
| **6** | 规模化 | 画布 P4 WebGL 兜底;事件驱动积分架构开放社区规则;协作(P5) | 远期 |

**先做的两件事:** ①「领域分类 v1」(改动小、把当前 B 类场景做扎实)②「画布 P1」(React Flow 等价替换,现有 `layout.ts` 已是接口雏形)。两者都不破坏现有 Demo。

---

### 附:调研完整报告
三份完整调研(含逐条 URL 出处、对比表、学术引用)由三个研究 agent 产出,要点已综合于上。如需展开某一块的原始细节可再生成。

---

## 六、II 期落地决策(移动地图 / 节点详情 / 诊断升级)

又做了三方向深度调研并落地。决策与依据:

### 6.1 移动竖屏地图 —— React Flow 加 TB 纵向(已落地)
- **决策**:给 `layeredLayout` 加 `dir:'TB'`(轴对调,零依赖,研究推荐"方案 A");canvas 窄屏(≤820)自动竖排 + 手动横/竖切换;连接点按方向放置。
- **依据**:多邻国 2022 从技能树改纵向 path(为初学者优化完成率);触摸目标 ≥44–48px(Apple HIG / Material / WCAG 2.5.5)。
- **下一步(研究推荐,未做)**:手机竖屏专门的"蜿蜒路径渲染器"(复用拓扑序 `ordered`,原生纵向滚动、吸顶当前/下一步、自动滚到当前),React Flow TB 留给平板/横屏。

### 6.2 节点详情 + 开始学习 —— 抽屉 + LLM 微课(已落地)
- **决策**:点节点 → **抽屉**(桌面右 / 手机底 sheet,渐进披露:领域/状态/时长/前置/解锁/开始学习,非弹窗);**开始学习 → 按需 LLM 微课**(讲解 + worked example + 一道检查题),扩 `serve.py`/Worker 的 `/lesson` 端点;检查题判分 → `recordResult`(FIRe 传播 + FSRS 门控)。
- **依据**:roadmap.sh AI Tutor 已验证同形态;NN/g(节点详情=与背景配对的内容→抽屉非模态);微学习元分析(留存 OR=1.87)、worked-example effect(Sweller)、检索练习/测试效应(Roediger & Karpicke)。

### 6.3 诊断升级 —— 诊断题 + 信心(CBM),替换"会/不会"(已落地)
- **决策**:废弃二元自评。三层证据:自评只动先验;**诊断性干扰项单选题 + 信心档(CBM)做客观探针**;按领域类 A–F 变体。一次性批量出题(`/probe` 端点),再用**信息增益**自适应选题,**信心调制 BKT 的 slip/guess**(自信地错→强力下拉),KST 前沿传播,12–18 题早停;反考试化文案。
- **依据**:二元自评不可靠(Dunning-Kruger ρ=−0.59;自评 vs 客观测验 rho≈0.49);Certainty-Based Marking(Gardner-Medwin,proper scoring rule);BKT 长期等价 IRT,现有信息增益≈CAT 的最大 Fisher 信息;ALEKS 用 KST 前沿"一题定位一片"。
- **下一步(研究推荐,未做)**:完整"开放学习者模型"——让用户对结果说"我其实会",系统用一道探针协商再上调。

> CBM 折算实现:`Diagnosis.answerConf(id, correct, confidence)` 按信心档把该次更新的 `pG/pS` 乘以系数(high→0.2 / mid→0.6 / low→1.3~1.6),再走标准 BKT 后验 + 前沿传播。
