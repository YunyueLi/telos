# Telos · 交接 / 路线图（活文档）

> 这份文件是「接下来要做什么 + 现状地图」的单一真相源。每次开工先读它、做完更新它。
> 交付标准（最重要）：**极致完成度、不闭门造车（先广度+深度 web search、参考头部 OSS/产品/论文）、细节一次做全。**

---

## 0. 项目快照（现状）

**Telos = 逆向设计学习引擎**：说目标 → LLM 倒推出带前置依赖的能力图谱(DAG) → 诊断起点 → 交互式微课只教缺的、边教边验证 → FSRS 间隔复习。已是**单一真实产品**（不再有 demo 宇宙 / mockup 框架）。

### 产品形态（web，Next.js 16 静态导出，部署到 GitHub Pages /telos/app/）
- 路由：`/`（Hub：无项目→全屏引导 onboarding；有项目→地图主页 map-home）· `/diagnose`（CBM 起点诊断，全屏接管）· `/review`（FSRS 复习）· `/me`（资料+项目库+设置+备份）。
- 微课 & 节点详情是**全屏接管 / sheet 覆盖层**，不是路由（静态导出无法用动态 id 路由）。
- 外壳 `components/app-shell.tsx`：顶栏(品牌/当前目标/新学习/连胜/XP/头像) + 移动底部三 Tab(地图/复习/我)。

### 关键文件
| 文件 | 作用 |
| --- | --- |
| `web/lib/telos/use-project.tsx` | **单一真相源 Context**：多项目库 projects/active/composing + derive/record/reviewCard/applyState/switchProject/startNew/removeProject。Provider 挂 `app/layout.tsx` |
| `web/lib/telos/project.ts` | 多项目 localStorage：`telos:projects` 映射 + `telos:active`；自动迁移旧的 `telos:project` |
| `web/lib/telos/derive.ts` | 端点配置(`telos:derive-url` / env `NEXT_PUBLIC_TELOS_DERIVE_URL`) + `deriveGraph` / `generateLesson` / `generateProbes` / `getLessonUrl` / `getProbeUrl`。**Lesson 已是分步 schema**（见下） |
| `web/lib/telos/engine.ts` | 引擎：KST·BKT·CBM·FSRS·FIRe，领域 A–F，`buildView` 在 store.ts |
| `web/lib/telos/{store,xp,layout}.ts` | LearnerView / XP+连胜 / 分层布局(LR·TB) |
| `web/components/canvas.tsx` | React Flow 地图：LR/TB；**双指平移+捏合缩放**(panOnScroll/zoomOnPinch)；>6 节点时 setCenter 到"活动区域"几何中心、zoom 0.95，否则 fitView |
| `web/components/path-view.tsx` | 手机竖屏蜿蜒路径 |
| `web/components/node-panel.tsx` | 节点详情 sheet + 挑战(OLM)；lesson 阶段委托给 lesson-runner |
| `web/components/lesson-runner.tsx` | **交互式 6 步微课状态机**：predict→explain→worked(分步揭示)→self_explain→faded(完成式+提示阶梯)→retrieve(掌握闸门)。判分回填 onGrade |
| `web/app/globals.css` | 设计 token + 全部产品 CSS：`.app*`(shell) `.ob-*`(引导) `.mh-*`(地图主页) `.rv-*`(复习) `.me-*`(我) `.dx-*`(诊断)。旧 landing mockup CSS 已删 |
| `web/components/app.module.css` | 画布/节点/路径/微课的 module 样式(`.rfNode` `.lhead` `.opts` `.lhint` `.lgiven` …) |
| `core/telos_core/llm.py` | `derive_graph` / `lesson` / `probes` + prompts + 校验。serve.py 调它 |
| `core/serve.py` | 本地 CORS 代理 :8787，路由 `/derive` `/lesson` `/probe`，读 `core/.env` |
| `workers/derive.js` | 生产 Cloudflare Worker，镜像 serve.py（**改一处要两处同步**） |

### 微课契约（serve.py 经 llm.py + workers/derive.js 都遵守）
`POST /lesson {name,domain,prereqs,goal}` →
```
{ "concept": "一句话核心",
  "steps": [ {kind:"predict",prompt,options[],answer,reveal},
             {kind:"explain",text,analogy},
             {kind:"worked",problem,steps:[{do,why}]},
             {kind:"self_explain",prompt,options[],answer,rationale},
             {kind:"faded",problem,given[],prompt,options[],answer,hints[],rationale},
             {kind:"retrieve",prompt,options[],answer,hints[],rationale} ],
  "resources": [ {name, platform} ] }
```

### 本地运行
```
cd core && python3 serve.py          # :8787，读 core/.env（用户的 DeepSeek key 已在里面，已授权使用）
cd web  && npm run dev               # :3000
# 网页端点：localStorage telos:derive-url = http://127.0.0.1:8787/derive（或在 /me 设置里填）
```
- 改 `core/*.py` 后**必须重启 serve.py**。改 web 一般 HMR；CSS module 偶尔要 `rm -rf web/.next` 再起 dev。
- 构建检查：`cd web && npm run build`。引擎测试：`cd core && python3 run_tests.py`（21 passed）。

### 约定（硬性）
- 提交：conventional，结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。代码改动**默认直接提交+push+部署**（push main → Actions deploy.yml → Pages）。
- **绝不**提交 `.env`/任何 key；提交前 secret 扫一遍（`git diff --cached | grep -E "sk-[A-Za-z0-9]{20,}"`）。
- 回复中文、不写"总结"段、禁 emoji、用手绘 Icon。`devIndicators:false`（左下 N 已隐）。

---

## 1. ✅ 已完成：#4 + #5 —— agentic 检索 + 真实引用链接（方案 A）

**已交付**：微课「延伸学习 · 真实来源」改为 ChatGPT/Perplexity 风格的**出处卡片**（favicon + 标题 + 域名）。配了检索 key → 先联网搜真实来源、模型只能 `ref` 引用、校验层回填真实 URL，**直达具体视频/文档**；没配 key → **优雅降级**回平台搜索链接（标注「· 搜索」），不报错照常用。已实测降级路径渲染正确、grounded 的 ref 解析逻辑单测通过、`npm run build` + 21 引擎测试通过。

**两端实现**（llm.py 与 workers/derive.js 已同步）：
- `web_search(query,k)` → `[{title,url,snippet,domain}]`，provider=tavily|youtube|none，none/出错→`[]`。
- `lesson()` 先 `web_search(f"{goal} {name} 教程 公开课")`，有结果就把【真实来源】块塞进 prompt、令模型用 `ref` 下标引用（禁编 URL）；校验层 `_resolve_resources`/`resolveResources` 把 `ref`→`{name,url,domain,platform,snippet}`，去重、取前 3。
- 前端 `LessonResource` 加 `url?/domain?/snippet?`；`lesson-runner` 的 `ResourceCard`：有真实 `url`→favicon+域名直达；降级→`platformDomain()` 映射平台 favicon + `resourceUrl()` 搜索链 +「搜索」标注；favicon 裂图兜底首字母。

**怎么开启真实链接**（给用户）：在 `core/.env` 加 `TELOS_SEARCH_PROVIDER=tavily` + `TELOS_SEARCH_API_KEY=tvly-...`（[tavily.com](https://tavily.com) 注册，~1000 次/月免费），**重启 serve.py** 即生效。线上 Worker：`wrangler secret put TELOS_SEARCH_API_KEY` + `wrangler.toml [vars] TELOS_SEARCH_PROVIDER`。详见 `DERIVE.md`「联网检索」。

> ✅ grounded 已用 Tavily key 端到端实测：web_search 命中真实来源 → 微课资源回填真实直达 URL（如 zh-hans.react.dev/reference/react/useMemo）→ 前端引用卡显示真实 favicon + 域名 + 直达链接。本地 key 在 `core/.env`（`TELOS_SEARCH_PROVIDER=tavily` + `TELOS_SEARCH_API_KEY`，已 gitignore）；线上 Worker：`wrangler.toml [vars] TELOS_SEARCH_PROVIDER="tavily"` 已就位，待用户跑 `wrangler secret put TELOS_SEARCH_API_KEY` + `wrangler deploy`。

---

## 2. 待办 backlog（按建议顺序）

- ~~**#10 简化 API 配置**~~ ✅ 已完成：新建共用组件 `components/endpoint-config.tsx`（onboarding 与「我」共用）——预设 chip（本地 serve.py / 线上 Worker / 自定义）一键填 + 单字段 + **「测试连接」**（打 `/health` 即时 ✓ 已连接·模型·key 就绪 / ✗ 原因）+ 保存。`derive.ts` 加 `LOCAL_ENDPOINT` + `getDeriveUrl()` 在 localhost 零配置默认指向本地 serve.py + `getHealthUrl()`/`testEndpoint()`。已实测：本地自动绿、chip 切换预填、假地址红。key 仍只在服务端。
- **#6 一屏 + 移动端**（task #31）：核心已完成 —— 移动端地图主页用 `.mh-rail{display:contents}` + `order` 重排为**「推荐下一步 + 开始学习」置顶可立即行动 → 路径全展开（不再 62vh 裁切隐藏后半截）→ 进度/诊断/复习/连胜**。已实测 375×812：CTA 在首屏内(y≈153)、`.apptabs` 固定底栏、/review 空态正好一屏。桌面本就一屏(`.mh max-height`)。**剩余可选打磨**：onboarding/诊断窄屏细调；/me 是设置中枢（2020px，滚动可接受，如要更紧可折叠分区）。
- ~~**#8 学习页去浮层**~~ ✅ 已完成：微课不再是暗色蒙版上浮起的圆角卡片，改为**纯纸感全页接管**——`.lessonFull` 背景 `var(--paper)`(无蒙版)、`.lessonPlate` 去圆角/去外框、改为 920px 居中阅读列(两侧细线界定) + 满高，保留深色 hero 头与 ✕ 返回。已实测计算样式(bg=paper、radius=0、plate 920×viewport 居中)+ 视觉(读起来是「一页课」非弹窗，出处卡片正常)。
- ~~**#7 多语种 i18n**~~ ✅ 已完成：9 语言（简中/繁中/英/法/日/韩/西/俄/德）。自建轻量 i18n（`lib/telos/i18n.tsx` Provider + `useT()` + `tStatic()`；字典 `lib/telos/i18n-dict.ts` 约 150 键 ×9）。两层都通：①**UI 文案**——全部组件（外壳/引导/地图主页/路径/节点/微课/诊断/复习/我/端点配置/画布）+ domainLabel/subLabel（经 buildView 注入 t）+ derive 错误（tStatic）已接 `t()`；②**LLM 输出语言**——derive/lesson/probe 请求带 `lang`，serve.py+llm.py 与 worker 注入 `_lang_directive`/`langDirective`，JSON 键名/枚举保持英文。顶栏 `LangSwitch` 组件（原生 select 叠加），落 `telos:lang`，默认按浏览器语言。已实测：英文/日文 UI 全量切换、English 倒推产出英文节点名、21 引擎测试通过、build 通过。
- **#17 云同步**（task #17，pending，阻塞）：Supabase 跨设备同步 `telos:projects`。等用户建 Supabase + 给 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`（见 SUPABASE.md / `web/lib/telos/cloud.ts`）。当前 /me 已有**离线备份码**导出/导入兜底。

---

## 3. 注意事项
- 用户用**自己的 DeepSeek key**（在 core/.env，已明确授权使用，别再提醒轮换）。搜索 key 同理放服务端。
- 后台进程：serve.py(:8787)、`npm run dev`(:3000) 可能需在新会话重启。
- 已完成里程碑：单一产品重做、多项目库、新学习入口、隐藏 dev 指示、地图居中+可读比例尺+双指手势、**#9 交互式微课**（已实测红楼梦全程跑通）、**#4+#5 检索 grounding + 出处卡片**（Tavily 已装配，grounded 端到端实测：真实 URL + favicon + 域名）、**#10 配置简化**（预设+测试连接+本地零配置，已实测）、**#6 移动端主页重排**（CTA 置顶+路径全展开，已实测 375×812）、**#8 学习页去浮层**（纸感全页接管，已实测）、**#7 九语种 i18n**（UI 全量 + LLM 输出语言 + 语言切换，已实测）。
- 全局工作偏好已写入 `~/.claude/CLAUDE.md`（在 ~/clauderoam，需 `clauderoam push` 同步）与项目 `CLAUDE.md`。
