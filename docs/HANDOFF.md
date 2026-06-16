# Telos · 交接文档（续作必读）

> 给下一个会话/设备：先读这份，再读 `README.md` / `CLAUDE.md` / `SUPABASE.md` / `docs/STRATEGY.md`。
> 本版覆盖到**形象经济 / 书斋 + 商业化（托管 AI / 模板店 / 证书 / Anki）+ Greenroom 协同 + 自定义域迁移**之后（截至 2026-06-15，HEAD `921c0ce`）。形象经济总览见 **§0b**；当前真实 TODO 见 **§7**。

---

## 0. 一句话现状

倒推多段层级化（30–80 节点）、模型 deepseek-v4-pro。账号+跨设备同步上线（Supabase：邮箱/密码、魔法链接、Google ✅；GitHub 待开）。**线上为 BYOK，且 key 跟账号绑定**：**（`9a001e6` 起）有 key 的用户走「浏览器直连 provider」**（`directMode`→`derive-direct.ts`，绕过被墙的 `*.workers.dev`，key 只发往用户自己的 DeepSeek/Tavily）；**无 key 访客/非受限网络才回退 Worker** `telos-derive.xuanlyy.workers.dev`（编排镜像、随请求经 `X-Telos-Key` 头发出、Worker 不留存）。key 登录后在「接入状态」绑定 → 存 Supabase `user_metadata` + 本机镜像；**登录自动连接、退出登录即休眠 key（停止发送→未连接，但不删除本机副本）**（未登录刷新也是未连接，云端已配置时 AI/搜索弹层只显示「登录后绑定」面板）；站长已**删除 Worker env key** → 纯 BYOK 零成本。多人激励「坚持」Tab、营销落地页、隐私/条款页、设计参考 `docs/DESIGN.md`、首个 Release **v0.1.0** 均已上线。
> **本程（直连之后）再加并上线**：学习地图可**导出**（PNG/PDF/思维导图 Markdown）；**路径↔地图**视图切换（手机默认路径、电脑默认地图，均可切，选择持久化）；画布**标出阶段区域**（虚线框 + 「01 模块名」，导出同绘）；节点卡不再截断（208×88·4 行）；**出题杜绝「凭语气猜答案」**（选项同质·禁中庸即答案·靠硬知识·真实误区干扰项，三引擎同步）；倒推后加**对抗式专家审查 + 自动修补**（`critiqueAndRepair`：补漏前置/删假前置/对齐难度顺序/含糊改写/补缺失关键节点，非破坏、有上限、14.6s）；**侧栏信息分层重构**（hero 行动 + 精简进度 + 阶段 + 降级的重测链；移除冗余连胜/XP、空复习卡、图例）。详见 §3「本程交付」、§7 验证路线。
> **BYOK 三处根因已全部修复并上线**（用户反馈"线上填 key 没用 / 配置不随账号走"）：
> 1. `telos:derive-url=127.0.0.1` 残留覆盖 → 线上去打本机 serve.py。修：非本机页面忽略 localhost 覆盖（`61885dc`）。
> 2. **接口地址被填成 `"DeepSeek"` 等非 URL** → Worker 拼 `DeepSeek/chat/completions` 抛 `Invalid URL`。修：新增 `cleanBaseUrl()`（缺协议补 https://、剥误粘的 `/chat/completions`、主机不像域名判无效）；`llmHeaders` 只发合法 base（自愈脏值，无需用户操作即可倒推）；保存时校验+提示、加载时显示规整值（`73c5708`）。
> 3. **配置不随账号走**：原推送仅「保存且已登录」、拉取仅「本机无 key」→「先填 key 后登录」既不上传又跳过拉取。修：登录时按 `updatedAt` 双向对账（后写入者胜），`LlmConfig` 加 `updatedAt`、`setLlmConfig` 广播 `telos:llm` 事件、接入状态卡监听即时重测（`73c5708`/`fc0592b`）。
> 4. **key 改为「跟账号绑定」**（用户要求：登录＝连上我的 key，退出＝没 key）。**踩过的坑（已修正）**：先实现成「登出/未登录即删除本机 key」（`47ae529`），但账号端若从未成功推送过 key（早期在未登录/旧代码下填的，只存本机），删本机＝删唯一副本 → 老设备登录着也变未连接、key 彻底丢失。**改为非破坏式**（`c4139d6`）：新增 `derive.ts` 的 `_keyActive` 门——休眠时 `llmHeaders` 不发送任何自带配置（→ 未连接），但**绝不删除本机 key**；Provider 按登录态 `setKeyActive(!!user)`（自托管恒 true）。登录仍用 **`getUser()` 拉服务端最新** `user_metadata` 回填（`fba9184`，避免新设备 JWT 旧缓存拉不到）；保存推送打日志 `[telos] BYOK push`（`860737b`）、登录对账打 `[telos] BYOK sync`（便于诊断账号端到底有没有 key）。云端已配置但未登录时弹层显示「登录后绑定」面板。**自托管未配 Supabase 时不受影响**。
> 验证链：cleanBaseUrl 单测 + 线上 chunk grep + 无 base 的 curl 42 节点；Preview 实测**未登录刷新 key 被保留（非破坏）且显示未连接**、绑定面板正常、无报错。**跨设备前提＝账号端 user_metadata 真有 key**：靠登录态保存（必推送）或登录对账（本机有 key 而账号没有→推上）。若用户历史 key 已被旧版误删，需在任一登录设备**重新填一次** key（console 出 `BYOK push {ok:true}` 即已入账号），其它设备登录即 `getUser` 拉回。

---

### ✅ 已解决（`9a001e6`）：线上「连不上」真因＝`*.workers.dev` 被墙 → 改用浏览器直连 BYOK

> **真根因（实测坐实，非推测）**：用 Claude-in-Chrome 直接在用户浏览器（Browser 1 `51ade0a5…`，中国网络）跑可达性探针——
> **整个 `*.workers.dev` 域不可达**：`telos-derive.xuanlyy.workers.dev` 与对照组 `example.workers.dev` 都**连接挂起 7–8s 超时**（不是快速失败，典型 GFW 对 Cloudflare 共享 workers.dev 的封锁）；同一浏览器 `api.deepseek.com`(90ms)、`api.tavily.com`、`cloudflare.com` 主站、`github.io`、`google` **全部可达**。
> → 所以 `testEndpoint` 打 Worker `/health` 的 fetch 挂起抛错 = `cantConnect`。**前 1 天多查的 localStorage 覆盖 / key / 账号同步全是红鲱鱼**——Worker 代码/CORS/env 注入都没错，错在它的域名在中国连不上。（`telos:derive-url=127.0.0.1` 那条覆盖确实在，但只是 HTTPS→HTTP 混合内容 2ms 秒拒，不是主因；`23af077` 也不解决——清掉覆盖后照样去打打不通的 Worker。）
>
> **修复＝真·BYOK 浏览器直连**（`9a001e6`）：用户配了自己的 key 时，前端**直接调用 provider**（DeepSeek/Tavily，均实测 200+CORS 放行），不再经任何代理 Worker。
> - 新增 `web/lib/telos/derive-direct.ts`：把 `workers/derive.js` 的三段式层级倒推（蓝图→并行展开模块→汇编/断环）+ 微课/诊断/标题/Tavily 检索**移植到浏览器端**（第三处镜像，改编排要三处同步：llm.py / derive.js / derive-direct.ts）。
> - `derive.ts` 路由：`directMode()=keyActive()&&hasLlmKey()` → 走直连；否则回退 Worker（无 key 访客 / 非受限网络）。`deriveGraph`/`generateLesson`/`generateProbes`/`generateTitle`/`testEndpoint` 全部分流；新增 `engineReady()` 供 UI 门控（page/node-panel 改用它，不再依赖端点 URL）。
> - 顺手清理：生产页**物理删除**残留的 localhost 端点覆盖（`cleanupStaleEndpointOverride`，挂 Provider mount）；规整本机脏 base（如 `"DeepSeek"` → 用默认）。
>
> **已端到端验证（用户真实浏览器）**：①三张接入卡 = 已连接·deepseek-v4-pro / 已启用·Tavily / 已登录；②真实倒推「学会冲泡手冲咖啡」走完整 pipeline（蓝图→展开→汇编）产 **41 节点 6 模块**的图、渲染正常、节点名是动宾短语；③残留 localhost 覆盖已被自动清除、脏 base 已规整。**「连不上」彻底消失**。
>
> **遗留小事**：验证时创建的测试项目「手冲咖啡入门」可能还在用户项目列表（自动化删除时删「当前项目」会让 CDP 渲染卡住、没删成；用户正常点两下即可删，或留着也无害）。**根因若复发**（如用户换到能直连 Worker 的网络又退化）：记住 workers.dev 在中国不可达是常态，长久解法是给 Worker 挂**自有域名**（见 P2，需买域名），但有 BYOK 直连后 Worker 已非必需。

## 0b. 形象经济 / 书斋（本程新增 · 2026-06）

「书斋」`/studio` 升为一级导航（坚持↔我之间），形象经济独立成页，六板块：**形象集 · 画风主题 · 治学通行证 · 印章雅号 · 书斋装点 · 造型换装**。
- 引擎 `lib/telos/{pass,seals,studyroom}.ts`；解锁语义统一复用 `portraits.matchUnlock` / `ruleHint`（零重复）；跨设备同步走 `sync-state.ts`（领取=并集、佩戴/案头=偏好 LWW）。
- **治学通行证**（`studio-pass.tsx`）：12 阶按累计 XP 解锁，免费/治学双轨；治学轨独占物按「领取时是否 Pro」分账（`claimedPro`），非 Pro 不白嫖、升级可补领；横向赛道(≥760)/竖向长卷(手机)双布局；领取幂等发墨。**红线**：进度只能靠学、不可买跳级、无倒计时胁迫。
- **印章雅号**（`studio-seals.tsx`+`seals.ts`）：9 朱红金石印(SVG)+10 学者雅号；当前印钤完课证书、当前雅号上「我」页头部。
- **书斋装点**（`studio-room.tsx`+`studyroom.ts`）：8 件墨线文房清玩，案头上限 4。
- **造型换装**：诚实预览（真换装依赖逐套立绘，待出图，不交假功能）。
- **看板娘立绘**：本程接入 **16 张**（画风 2 Pro / 季节 4 / 学科场景 5 / 日常神态 4 / 里程碑 1），注册进 `portraits.ts`、绑学习里程碑解锁、补 9 语言名+台词。**待重做 4 张**（嘉许=合十非鼓掌 / 宗师=缺大师气度 / 执灯=灯被圆形缩略图裁掉 / 木刻=刀痕弱）；**文房 8 + 印章 9 待出图**。
- **纸色主题**（`theme.ts`，旧称「画风主题」；与看板娘「画风」泼墨/木刻是两个域）：纸色 + 卡片圆角协同（`data-theme`：su/xuan/niupi/yuebai），Pro 全解锁。
- **Pro 权益**：已补「书斋治学轨 · 全画风」（`/pro` 权益列表 + CLAUDE.md 同步）。
- **红线**：纯外观/荣誉、**绝不影响学习与 XP**；墨只赚不卖、无开箱抽卡。
- **出图母版**：`docs/IMAGE-PROMPTS.md`（全部素材 prompt + 是否需 hero + 生成进度 + 需重做标注）。
- **坑**：Lightning CSS 静默丢 root 的 `overflow` → 写在 `globals.css` 不生效，改 `layout.tsx` 的 `<html>` 内联 style 绕过（memory `lightning-css-drops-root-overflow`）。

## 1. 怎么跑（本地）

```bash
./start.sh        # 起 serve.py(:8787) + web(:3000) + 开浏览器；Ctrl-C 收尾
make test         # 引擎测试（应 21 passed）
npm --prefix web run build   # 生产构建（静态导出）；改完务必过
```
- `core/.env`（gitignore，含 key）：`TELOS_LLM_API_KEY`(DeepSeek)、`TELOS_LLM_MODEL=deepseek-v4-pro`、`TELOS_SEARCH_PROVIDER=tavily` + `TELOS_SEARCH_API_KEY`。
- `web/.env.local`（gitignore）：`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`（已配，见 §4）。**没有它本地账号功能降级为本地优先（不报错）**。
- **改 `core/telos_core/llm.py` 必须重启 serve.py**。**Turbopack 旧 CSS 缓存**老毛病：globals.css 改了不生效 → `rm -rf web/.next` 重启。
- 后台 serve.py/web 在会话结束会停，重开直接再 `./start.sh`。

## 2. 线上现状（自定义域 `telos.ungetsu.net`：landing `/`，app `/app/`；旧 `…github.io/telos/*` 由 GitHub 自动 301）

| 能力 | 线上状态 |
|---|---|
| 账号登录/注册（邮箱+密码、魔法链接） | ✅ 可用（Supabase 变量已注入构建，实测通过）|
| 跨设备同步 | ✅ 可用（`projects` 表 + RLS）|
| **倒推 / 微课 / 诊断（核心）** | ✅ **可用 · BYOK** —— Worker `telos-derive.xuanlyy.workers.dev` 用**调用方自带 key**（请求头 `X-Telos-Key` 等覆盖 env；前端「接入状态」填、存本机 + 随账号 `user_metadata` 同步）。env key 现仍在 → 无 key 访客暂仍用站长 key（软混合）；**站长收尾**：`npx wrangler secret delete TELOS_LLM_API_KEY`（+search）即变纯 BYOK 零成本。|
| Google 登录 | ✅ 已开（provider 配好可登）。同意页显示 `*.supabase.co` 域名——免费版限制，需自有域名美化（见 P2）|
| GitHub 登录 | ⬜ 待开（OAuth App 未建；流程同 Google，回调 `…supabase.co/auth/v1/callback`，见 P1）|
| 魔法链接 | ✅ Redirect URLs 已配（`/account/`）|
- 部署：push 到 main 自动触发 `.github/workflows/deploy.yml`；也可 `gh workflow run deploy.yml`。
- **线上环境变量用 GitHub Actions Variables**（repo → Settings → Secrets and variables → Actions → Variables）。`deploy.yml` build step 已注入 `NEXT_PUBLIC_SUPABASE_*`。**我（助手）可用 `gh variable set <NAME> --body <VAL>` 直接设**（gh 已登录 YunyueLi，scope 含 repo）。

## 3. 本程已交付（勿重做）

- **账号系统**：`/account` 登录·注册（邮箱+密码：显示/隐藏、无确认框；魔法链接；Google/GitHub 按钮）。`@supabase/supabase-js` + PKCE + detectSessionInUrl，回跳 `/account/` 自动换会话。登录成功 → 自动跳 `/me`。
- **跨设备同步**：登录后本地项目合并上云、变更即推、删除即删；「换设备」拉回——**全部实测通过**。
- **账户 IA**：头像 = **账户下拉菜单**（不再跳 /me，与「我」Tab 去重）；`/me` = 统一「我的」(进度 + 账户·同步区)；`/account` 退化为纯登录页。
- **接入状态**（设置页）：AI 引擎 / 联网搜索 / 跨设备同步 三张能力卡 + 状态点；技术端点收进「高级设置」折叠。`/health` 已透出 `search` 状态。
- **顶栏**：桌面三段分组（导航｜进度+新建｜系统/账户），语言降级地球图标，进度合并药丸；**移动端 = grid 三段真居中**（logo 左·切换器中·新建+头像右），齿轮在移动端隐藏（设置走头像菜单）。
- **学习项目切换器**：顶栏「目标」下拉（移动底部抽屉）+ 搜索/状态分面/排序/键盘。
- **自定义下拉** `SelectMenu`：替掉语言/排序的原生 `<select>` 系统框。
- **倒推等待**：分阶段进度条（理解→规划蓝图→展开模块→汇编）+ 缓动进度 + 实时秒数。
- **达标线**：`tier-text` 修复，按 `。/；/英文". "` 切分（不切小数）→ 新手/进阶/精英 分行。
- **设置「我的学习」网格**：默认 6 个，超出「展开全部 N / 收起」。
- **多邻国式激励 = 独立「坚持」Tab**（地图 · 复习 · **坚持** · 我，复习之后；`app/streak/page.tsx` + `components/streak-board.tsx`，全屏响应式手机单列 / ≥760 左右分栏）。含：连胜横幅 + ①今日目标环（自定档位 + 达标庆祝 `goal-celebrate.tsx`）+ ③断签保护 + **④等级卡**（Lv + 段位 + 进度 + ⑤段位天梯 + 个人纪录）+ ②**月历打卡**（翻页看历史月、真实日期号、星期对应）+ **④成就网格**（8 枚）。底座 `xp.ts`→`telos:daily`（每日 XP 流水/goal/freezes/frozen/rewarded + 等级曲线 + maxStreak/bestDay/totalXp），集成进 `use-project`（学习算真实 XP delta、达标触发 `goalNonce`、暴露 `dailyVersion`）。新图标 flame/shield/calendar/medal。连胜数字三处呼应：顶栏火焰药丸 · /me 快览 · 坚持 Tab。详见 §7。**多档宽度 Preview 实测**。**唯一未做：⑤ 多人周联赛（需 Supabase 表，见 §7）。**
- **开箱即用简化**：Worker 加 **一键 Deploy to Cloudflare 按钮**（`workers/` 子目录，README + DERIVE.md §B；替掉 wrangler CLI 折磨，密钥走 dashboard UI 避开"整行当 name"坑）+ `workers/package.json`。新增 `web/.env.example`（Supabase/derive URL 模板，全可选）。`core/.env.example` 标注「任意 OpenAI 兼容端点」。README「Deploy your own」改为「唯一必需=Worker + 可选项优雅降级表」。本地 `start.sh` 早已自动建 env。

## 4. Supabase 配置现状（精确）

- 项目：**YunyueLi's Project**，URL `https://gbvetfyudlbdiydapipr.supabase.co`（Singapore）。
- Key：用**新版 publishable key**（`sb_publishable_…`，公开可暴露、受 RLS 保护）。存放：本地 `web/.env.local` + 线上 Actions Variables。**绝不用 `sb_secret_…`**。
- 已配：`mailer_autoconfirm = true`（**注册即登录、不发确认邮件**）；Email provider 开；`projects` 表 + RLS「own rows」已建（脚本见 `SUPABASE.md` §2）。
- **未配（待办，见 P1）**：Google/GitHub provider（`google=false, github=false`）；**Redirect URLs 未加**（魔法链接 / OAuth / 邮件确认回跳要用——加 `http://localhost:3000/account/` 和 `https://telos.ungetsu.net/app/account/`）。
- **测试账号待清**：`telos.e2e.check@gmail.com`、`telos.iatest@gmail.com`（实测建的，项目数据已删）。可在 Authentication → Users 删掉。

## 5. 架构新增 + 关键文件

- `web/lib/telos/supabase.ts` — 客户端单例（PKCE/detectSessionInUrl/persist），`cloudConfigured()`。
- `web/lib/telos/auth.tsx` — `AuthProvider`/`useAuth`（session/user + signInPassword/signUpPassword/signInMagicLink/signInOAuth/resetPassword/signOut）。挂在 `app/layout.tsx`（Lang>Auth>Project）。
- `web/lib/telos/cloud.ts` — SDK 同步：`pullProjects/pushProject/deleteRemoteProject`（表 `projects(user_id,id,data,updated_at)`，per-project 最后写入者胜）。
- `web/lib/telos/use-project.tsx` — 集成同步：登录后 `syncNow`（pull+合并+回推）、mutate 即 `pushCloud`、删即 `deleteRemoteProject`；暴露 `cloudOn/syncing/lastSync/syncNow`。
- `web/components/account-menu.tsx`（头像下拉）· `select-menu.tsx`（自定义下拉）· `project-switcher.tsx`（项目切换器）· `endpoint-config.tsx`（接入状态卡 + 高级）· `tier-text.tsx`（达标线分级，无标签续句并入前段）。
- **`web/lib/telos/derive-direct.ts`** — 浏览器直连倒推引擎（线上**主路径**）：蓝图→并行展开→汇编→`critiqueAndRepair`(对抗式审查) ；直连 DeepSeek/Tavily(`/chat/completions`、`api.tavily.com`)。`derive.ts` 用 `directMode()=keyActive()&&hasLlmKey()` 路由到它，否则回退 Worker；`engineReady()` 供 UI 门控；`cleanupStaleEndpointOverride()` 清残留 localhost。
- **`web/lib/telos/map-export.ts`** — 地图导出：canvas 2D 直绘节点/连线/阶段区域 → PNG（`toDataURL`）/PDF（`jspdf`，px+compress）；思维导图 Markdown 在 `canvas.tsx`（按阶段分组）。**不用 html-to-image**（它内联字体+克隆 DOM，大图阻塞主线程 45s+）。
- `web/components/canvas.tsx` — React Flow 画布：新增 `StageNode`(阶段区域)、导出菜单(top-left Panel)、桌面也渲染路径切换。`app/page.tsx MapHome` 持 `phoneView` 状态 + 侧栏重构。
- ⚠️ **三处倒推引擎须同步**（改 prompt / 编排 / 审查务必三处一起改，否则漂移）：`core/telos_core/llm.py`(本地 serve.py) · `workers/derive.js`(Worker，**被墙**·改完须用户 `npx wrangler deploy`) · **`web/lib/telos/derive-direct.ts`(线上直连·主路径)**。出题提示(PROBES/LESSON_REQS)、`critiqueAndRepair`、`langDirective`、`/health` 的 search 透出都在这三处。
- **付费系统（Telos Pro）**：
  - 架构：服务商(MoR)托管收银台 → **webhook → `workers/derive.js` 的 `/billing/webhook`**（HMAC 验签）→ 用 service_role 写 **Supabase `app_metadata.telos_pro/telos_plan/telos_pro_until`**（用户不可自改，区别于 user_metadata）→ 前端 `lib/telos/billing.ts` 的 `refreshEntitlement()`(getUser 拉最新) 缓存 `telos:billing` + 广播 `BILLING_EVENT`；`isPro()` 同步读。webhook 由服务商服务器直连 Worker，**不受 GFW 影响**（被墙只影响浏览器访问 workers.dev）。
  - 配置单点：`web/lib/telos/billing-config.ts`（provider/价格/checkout URL/manageUrl/freeProjectLimit=3）；Worker 端 `wrangler.toml [vars]` BILLING_PROVIDER + SUPABASE_URL，secret：`BILLING_WEBHOOK_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`。
  - 免费 vs Pro：免费=3 项目 + 带水印导出；Pro=无限项目 + 无水印导出（`map-export.ts` 按 `watermark:!isPro()`）+ 未来 Pro 功能。
  - UI：`/pro` 定价页（登录→checkout 带 `user_id+plan`→回跳 `?success=1` 轮询确认；恢复购买=refreshEntitlement）；设置页 Pro 卡；导出菜单「去水印·Pro」；onboarding 超限提示卡 + `use-project.derive()` 硬校验。
  - 调试：本机 `localStorage.telos:pro=1` 强制 Pro（仅本机展示）；正式权益以 app_metadata 为准。
  - **托管 AI（开箱即用）**：无 BYOK 的请求（不带 `X-Telos-Key`）→ Worker `hostedGate` 验 Supabase token（`/auth/v1/user`）→ 配额（KV `TELOS_USAGE`：`u:<uid>:<YYYYMM>` 月度 / `t:<uid>` 试用总量 / `b:<uid>` 加油包余额；vars `HOSTED_*` 可调：Pro 30 倒推+600 微课/月，试用 3+60）→ 成功才 `commit()` 扣次。错误码 NEED_LOGIN/HOSTED_TRIAL_USED/HOSTED_QUOTA/NO_HOSTED → 前端 `derive.ts hostedErrorMessage` 本地化。客户端：`auth.tsx` 随会话 `setHostedToken`，`llmHeaders` 无 BYOK 时带 Bearer；`engineReady = directMode || hostedReady`；`/billing/usage` 给 /pro 用量条。加油包 SKU `pack_d10`/`pack_l200`（checkout plan 传值，webhook 充 KV bonus）。BYOK 请求完全旁路计量（零成本路径不变）。
  - **Anki 导出（Pro）**：`lib/telos/anki-export.ts` 官方文本导入格式（#separator/#html/#tags 文件头），正面=能力、背面=desc+怎么练+达标线、标签=telos+阶段；导出菜单 Pro 显示下载、免费显示 `· Pro` 引导。
  - **模板店（知识付费）**：`/store` 页（大纲预览/导入/购买）。**内容安全（核心）**：付费图谱完整内容（desc/drill/benchmark）**绝不进前端/仓库**（否则被白嫖）——前端 `lib/telos/templates.ts` 只留 meta + 脱敏大纲（模块名+数量+总时长）+ 免费模板(科二)内嵌 points；付费内容存 KV `tpl:<id>`（私有母版 `workers/templates-private.json`，**git-ignored**，`workers/seed-templates.sh` 用 jq 灌入），Worker `POST /template` 鉴权(`verifyUser` → 已购 `app_metadata.telos_templates` 或 Pro)后下发 → 前端 `derive.ts fetchTemplatePoints`(带 Supabase Bearer)拉取再导入；错误码 NEED_LOGIN/NOT_OWNED/NO_TEMPLATE/NO_HOSTED 本地化。获取=免费(内嵌直接导入) | 已购(webhook `tpl_*` SKU 发货·读改写合并) | **Pro 全解锁**（原"每月免费领 1 个"已升级为全解锁——下发鉴权即 `owned || isPro`，顺带删掉前端 localStorage `telos:tpl-claim` 弱约束；非 Pro 仍可单买）。导入走 `telos:open-map` 标记直达地图；受免费 3 项目上限约束。上新=改 templates.ts 加 meta+大纲 + 往 templates-private.json 加完整内容 + 重跑 `seed-templates.sh`（雅思/CFA 待写）。
  - **完课证书（Pro）**：`lib/telos/certificate.ts` canvas 直绘横版证书（双线图廓/罗盘/衬线名/编号 `TL-<hash>`/VERIFIED 印章），/me 项目卡 100% 完成时出 medal 按钮 → prompt 姓名 → 下载 PNG。真验真（服务端登记 + /cert/<no> 查询页）待接 Supabase。
  - **待办队列（按方案排期）**：学习周报邮件（需 Resend/CF Email + cron Worker + 退订，未开始）；班级/教练版（组织模型 + 加入码 + 全班热力图，Supabase 表 + RLS，未开始）；轻激励经济（冻结补充/形象集，低优先）。

## 6. 坑（必读）

- **Turbopack 旧 CSS**：改 globals.css 不生效 → `rm -rf web/.next` + 重启（preview 同理）。
- **preview MCP 与 start.sh 都占 :3000**（互斥）：用 preview 前先停 start.sh；要测倒推/接入状态另起 `（cd core && python3 serve.py）`。`preview_eval` 单次 ≤30s；`preview_resize` 重置 React 状态（localStorage 保留）。
- **Supabase 新 key 体系**：publishable 取代 anon，`supabase-js` 已支持；验证 key：`curl ".../auth/v1/settings" -H "apikey: <key>"`（200=有效，401=错），顺带能看 providers/autoconfirm。
- **i18n**：自研 9 语（`web/lib/telos/i18n-dict.ts`），**加 key 必须补全 9 语**；**重复 key 会让 `next build` TS 报错**（曾踩 common.close）。
- **.gitignore 实际只忽略 `.env` 与 `.env*.local`**——`core/.env.example`、`web/.env.example` **可提交且已在仓库**（`.env.local.example` 这种带 `.local` 的才会被忽略，故 web 模板命名为 `.env.example`）。`start.sh` 首次自动 `cp core/.env.example core/.env`。（旧版误记为"全忽略、别建 .example"，已纠正。）
- **设计语言**：纯黑白+暖灰纸感；Fraunces+Inter+JetBrains Mono；手绘线性图标（`sketch-defs.tsx` 的 `#i-<name>` + `icon.tsx` IconName）；**禁 emoji**；看板娘黑白墨线。
- **静态导出**：`output:export`，prod `basePath=/app`；`lib/base.ts` 的 `BASE`/`asset()` 给裸 `<img>`/href 用。

## 7. 后续工作（按优先级 · 续作主看这里）

### 待办速览

| # | 待办 | 优先级 | 谁做 | 状态 |
|---|---|---|---|---|
| 0 | ~~🔴 线上「连不上」(cantConnect)~~ | ~~P0·最高~~ | — | ✅ **已解决**（`9a001e6`）。真因＝`*.workers.dev` 被 GFW 屏蔽（实测对照组也不通），与 key/账号/CORS 全无关。改为浏览器直连 BYOK（`derive-direct.ts`），已在用户真实浏览器端到端验证（41 节点真实倒推 + 三卡全绿）。详见 §0 |
| 0b | ~~BYOK key 绑账号（登录连/登出休眠）+ 三根因~~ | ~~P0~~ | — | ✅ 已修上线（见 §0 1–4：`61885dc`/`73c5708`/`fc0592b`/`fba9184`/`860737b`/`c4139d6`） |
| 1 | ~~线上倒推端点（Worker 部署）~~ | ~~P0~~ | — | ✅ 已完成 |
| 2 | GitHub 登录（魔法链接 + Google 已开） | P1 | 用户 GitHub+Supabase | 剩 GitHub（建 OAuth App，回调 `…supabase.co/auth/v1/callback`，填进 Supabase provider，开了即生效；GitHub 同意页天然显示「Telos」） |
| 3 | 多人周联赛 ⑤（全局周榜） | P1 | 用户建表 → 我接客户端 | 方案+SQL 就绪（SUPABASE.md §2b），待建表 |
| 4 | 老项目「重新倒推」入口 | P2 | **我（可独立）** | 未开始 |
| 5 | ~~跨设备连胜/激励同步~~ | ~~P2~~ | — | ✅ **已完成**（`6c4d054`：连胜/打卡/墨/装扮无损合并，`sync-state.ts`；形象经济领取/佩戴/案头同程接入）|
| 10 | **图谱准确性 T4 经验闭环埋点**（护城河 · 用户最在意） | **P1** | **我（独立）** | 进行中（记录「掌握前置后做新节点的首答正确率」，数据从现在攒；见 §7 验证路线 T4）|
| 11 | 形象经济出图接入（重做 4 张 + 文房 8/印章 9） | P1 | 用户出图 → 我接 | 待素材；prompt 见 `docs/IMAGE-PROMPTS.md` |
| 6 | 文档继续扫（STRATEGY/ROADMAP 过时项） | P2 | **我（可独立）** | README/DERIVE 本程已扫 |
| 7 | Supabase 邮件模板本地化 · README 截图GIF · 删测试账号 | P2 | 我 / 用户 | 杂项 |
| 8 | **开通付费（Telos Pro）** | P1 | **用户外部动作** | 代码全就绪（webhook/权益/定价页/水印/项目上限）。剩：① 注册支付服务商(MoR)并建 3 个产品（月/年/买断）+ 2 个加油包（SKU 用 `pack_d10`/`pack_l200` 传 plan）；② 把 checkout 链接 + customer portal 填进 `web/lib/telos/billing-config.ts`（plans + packs）；③ 服务商后台 webhook 指到 `https://telos-api.ungetsu.net/billing/webhook`（自定义域；原 *.workers.dev 已禁用）；④ `cd workers && npx wrangler secret put BILLING_WEBHOOK_SECRET && npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY && npx wrangler deploy`；⑤ 沙盒买一单验证 `/pro` 自动解锁 |
| 9 | **激活托管 AI（开箱即用 · 商业化主引擎）** | P1 | **用户外部动作** | 代码全就绪（Worker 计量门禁 `hostedGate`/试用/月度配额/加油包 KV、客户端 token 注入与错误文案、/pro 用量条、引导页「登录免费试用」CTA）。**本程已做**：✅ KV `TELOS_USAGE` 建+绑+灌付费模板；✅ Worker deploy（含 `/template` 鉴权下发）；✅ 自定义域 `telos-api.ungetsu.net`（CF 代理·国内可达）+ 前端端点 gh variable 已切（根治 workers.dev 被墙）。**唯剩开托管 AI**（产生 LLM 成本·商业决策）：`cd workers && npx wrangler secret put TELOS_LLM_API_KEY`（+可选 `TELOS_SEARCH_API_KEY`）+ `npx wrangler deploy` → `curl https://telos-api.ungetsu.net/health` 应 `hosted:true`。**付费模板下发已凭 KV+Supabase 独立生效，不依赖此 key。** |

> **助手可完全独立**：#10（图谱 T4 埋点 · 护城河 · 进行中）、#4（重新倒推入口）、文档校准（本程已刷）。
> **卡用户外部动作**：#2 GitHub · #3 周联赛建表 · #8 Pro 收银台 · #9 托管 AI · #11 形象经济出图（你出图→我接）。
> 已完成：#5 跨设备激励同步（`6c4d054`）、#6 文档扫。

### 连接排查清单（#0 已解决，留作回归参考）
**先分清两种红字**：① **「连不上」=`cantConnect`**＝fetch 抛错；② **「已连通·缺 key」=`conn.noKey`**＝通了但没 key。卡片「未连接」＝`status.ok=false`。

A) **现在的连接路径（`9a001e6` 后）**：有 key → `directMode` 直连 provider（`testEndpoint` 打一次极小 DeepSeek 请求验证）。**若直连也报 cantConnect**：从用户浏览器实测 `api.deepseek.com`(或其 base) 可达性 + CORS——若挂起＝该 provider 域被该网络拦（换 base/provider）；若 200 但 testEndpoint 仍失败＝key 无效（401）。
> ⚠️ **历史教训**：`*.workers.dev` 在中国被墙（连接挂起 7–8s 而非快速失败），别再回去查 localStorage 覆盖/key/账号那条线——那拖了一天多全是红鲱鱼。验证可达性永远**在用户浏览器实测**（Claude-in-Chrome），别只信本机 curl（本机网络 ≠ 用户网络）。

B) **倒推/key（已闭环，留作回归）**：
1. **已确认 OK**：Worker + 用户 key 经 curl 实测返回 42 节点（`curl -X POST .../derive -H "X-Telos-Key: <key>" -d '{"goal":"…"}'`）。Worker/CORS/key 都没问题。
2. devtools → Application → Local Storage：`telos:derive-url`（应为空或 `…workers.dev/derive`，**不能是 127.0.0.1**）、`telos:llm`（应含 `key`；`base` 留空或合法 http(s) URL——**绝不能是 `"DeepSeek"` 这类非 URL**，否则 Worker 拼 `DeepSeek/chat/completions` 报 `Invalid URL`。新代码已自动忽略脏 base，但确认线上是新构建）。
3. Network 看 `/derive`：带 `X-Telos-Key` 头吗？`X-Telos-Base` 若有，须是合法 URL。响应码：401/NO_KEY=没带 key（config 没存上）；502 + `Invalid URL`=base 脏；CORS 错=预检头。
4. 确认线上是最新构建：`curl …/settings/` 取 chunk 名 → grep 该 chunk 含 `X-Telos-Base` / 新文案「完整网址，如」。GitHub Pages CDN 有缓存，hard-refresh。
5. **同步不生效**：确认已登录；登录时按 `telos:llm.updatedAt` 双向对账（账号新→拉回、本机新→推上）。Supabase → Authentication → 该用户 → `user_metadata.telos_llm` 应含 `key`。「先填 key 后登录」旧 bug 已修。

### 本程交付（this session：直连 BYOK + 导出 + 路径/地图 + 出题质量 + 审查 + 侧栏重构，均已 push+部署）
> 11 个提交见 §8。核心：
> - **直连 BYOK 根治「连不上」**（`9a001e6`）：真因＝`*.workers.dev` 被 GFW 屏蔽（实测对照组 `example.workers.dev` 同样不通），与 key/账号/CORS 无关——前 1 天多查 localStorage/key 全是红鲱鱼。改 `derive-direct.ts` 浏览器直连用户自己的 DeepSeek/Tavily；用户真实浏览器端到端验证（41 节点真实倒推 + 三卡全绿）。
> - **地图导出**（`5ce5191`→`fec940c`）：PNG/PDF/思维导图(MD)。html-to-image 大图卡死 45s+ → 改 `map-export.ts` canvas 2D 直绘；jspdf compress 把 PDF 51MB→62KB；42 节点 ~600ms。
> - **出题质量**（`8437dcd`）：诊断/微课 MCQ 之前能凭语气/长短/中庸挑答案 → 加【选项铁律】(同质·禁中庸·靠硬知识·真实误区干扰项·自检)，三引擎同步。线上用用户 key 实测有效。
> - **对抗式专家审查 + 自动修补**（`c095c11`→`b462ae5`→`b97be67`）：倒推后让"最挑剔同行专家"按真实领域实践挑硬伤并可执行修订（补漏/删假前置、对齐难度顺序、含糊改写、补缺失节点）。非破坏(失败/改崩→回退)、有上限、断环、~14.6s。三引擎同步。**＝§7 验证路线的 Tier 3；T4 未做。**
> - **路径/地图视图切换(手机+电脑)+阶段标识+节点不截断+微课分级换行+切换器间距+侧栏信息分层重构**（`5ce5191`/`8437dcd`/`e19e2bf`/`e329e40`）。

### 🧭 图谱准确性验证路线（续作核心战略 · 用户最在意）
> **关键认知**：BKT/FSRS/KST 是真教育学，但都跑在 LLM 倒推出的图谱之上——图错则高效教错。**护城河＝图谱正确性，不是引擎**。诚实层级（外部 > 自审；经验=金标准）：
> - **T0 结构**（已有）：无环/前置存在。必要不充分。
> - **T1 外部对照**（未做）：Tavily 比对真实课程大纲/能力框架，标每节点「几处佐证/无佐证/疑似遗漏」=可见可信度。
> - **T2 自一致性**（未做）：多次/多模型推，复现的可信、一次性的存疑。
> - **T3 对抗式专家审查**（✅ 本程＝`critiqueAndRepair`）：便宜的一道闸，但**同族模型有相关盲区、非终极**。
> - **T4 经验闭环**（未做 = **真正的护城河**）：用诊断/掌握数据反验前置边（掌握 B 的人对 A 首答高→边成立、≈瞎猜→边错；多学习者跑同一目标可学出真实前置结构）。**续作若做验证，先从这做：加埋点记录"掌握前置后做新节点的首答正确率"，让数据从现在开始攒。**
> 另一可选：画布加**阶段分带布局**做确定性「难度左→右递增」（审查是启发式、非硬保证）。

### 上程交付（账号系统 + IA 重构 + 多邻国激励 + BYOK 绑账号，历史）
多邻国式激励「坚持」Tab（每日目标/月历打卡/断签保护/等级段位/成就/段位天梯，①②③④⑤本地）· 登录区按钮等宽 · `docs/DESIGN.md` 设计参考 · 营销版落地页重写（对齐 App）· 隐私/服务条款页 · 魔法链接+Google 登录开通 · **P0 Worker 部署接线** · **BYOK**（用户自带 key+随账号同步+接入状态弹层重做+去"免费"措辞）· README/DERIVE 准确性审计 · 首个 Release **v0.1.0** + CHANGELOG · **BYOK 三处线上根因修复**（localhost 覆盖 `61885dc`、非法 base `cleanBaseUrl` + 配置双向同步 `73c5708`、推送前规整 base `fc0592b`；清掉 7 个含"免费"死键、新增 `conn.baseInvalid` 9 语）。

**后半程（key 绑账号 + 连不上）改动链**（全在 `web/lib/telos/derive.ts`·`use-project.tsx`·`components/endpoint-config.tsx`·`i18n-dict.ts`）：
- `47ae529` key 绑账号 + 弹层「登录后绑定」面板（`conn.bindNote`/`bindSignIn` 9 语）——**但登出删 key 是回退**；
- `fba9184` 登录对账改用 `getUser()` 拉服务端最新 metadata（修新设备 JWT 旧缓存）；
- `860737b` 保存推送打 `[telos] BYOK push` 日志；
- `c4139d6` **登出改「休眠」不删 key**（`_keyActive` 门，非破坏式，修上一条回退）；
- `23af077` **生产页忽略本机端点覆盖、强制构建端点**（修「连不上」自愈，**当前待用户浏览器确认**）。
- 当前代码 BYOK 设计：登录→`keyActive=true`＋`getUser` 拉回账号 key；登出→`keyActive=false`（休眠不删）→未连接；新设备→`getUser` 拉账号。`getDeriveUrl`：生产页 env 端点权威、忽略覆盖。

### P0 · 让线上能倒推 —— ✅ 已完成
- **Worker**：`telos-api.ungetsu.net`（**自定义域**·CF 代理国内可达，根治 `*.workers.dev` 被墙；账号 `xuanlyy`，`npx wrangler deploy`；`wrangler.toml` name=telos-derive、`routes custom_domain`、model=deepseek-v4-pro、provider=tavily、`ALLOW_ORIGIN=https://telos.ungetsu.net`、KV `TELOS_USAGE` 已绑）。原 `telos-derive.xuanlyy.workers.dev` 已禁用。
- **密钥**（用户 `wrangler secret put` 设，**值只填 value 不要带 `KEY=` 前缀**——曾踩坑把整行当 name）：`TELOS_LLM_API_KEY`(DeepSeek) + `TELOS_SEARCH_API_KEY`(Tavily)。`/health` → `available:true`、`search.available:true`。
- **接线**：`gh variable set NEXT_PUBLIC_TELOS_DERIVE_URL https://telos-api.ungetsu.net/derive`（已切新域）+ `deploy.yml` build env 注入 → 重新部署后线上 JS 含该 URL。
- **实测**：curl POST /derive 返回 48 节点；CORS 预检 github.io → 204 放行。端点路由：`/derive /lesson /probe /title /health`（前端把 `/derive` 替换出其余）。
- 改 `workers/derive.js` 后用户须重 `npx wrangler deploy`（助手可代跑 deploy，但 secret 须用户本人）。

### P1 · GitHub 登录（魔法链接 + Google 已开）
> 云同步对任何已登录用户都生效，与登录方式无关。邮箱+密码 / 魔法链接 / Google 均已可用。
- **已完成**：Redirect URLs（`http://localhost:3000/account/` + `https://telos.ungetsu.net/app/account/`，Site URL `…/app/`）；Google OAuth（client 配进 Supabase，provider 开，可登）。
- **剩 GitHub**：GitHub → Settings → Developer settings → OAuth Apps 建一个，回调 `https://gbvetfyudlbdiydapipr.supabase.co/auth/v1/callback`，client id/secret 填进 Supabase Google→GitHub provider。登录页按钮已就绪，开了即生效（GitHub 同意页天然显示 OAuth App 名「Telos」，无 Google 那种 supabase.co 域名问题）。
- 密码重置：`resetPasswordForEmail` 已接（「忘记密码」），同样需 Redirect URLs + 邮件模板。

### P1 · 多邻国式激励系统（①②③④ + ⑤本地 已交付 = 独立「坚持」Tab；剩 ⑤多人榜）
全在 `app/streak/page.tsx` + `components/streak-board.tsx`（全屏响应式：手机单列 / ≥760 左右分栏），底座 `xp.ts`→`telos:daily`。
- **① 每日目标**：用户自定 10/20/40/60 XP + 进度环 + 达标庆祝弹层 `goal-celebrate.tsx`。
- **② 打卡日历**：**月历翻页**（‹ › 看历史月、不可越当前月），格子标真实日期号、星期列对应真实星期、未来日虚线淡显、今日墨环、达成实心/学习 hatch/冻结盾角标。
- **③ 断签保护 freeze**：缺勤自动桥接、连胜每 5 天奖 1 个、最多持 2（与 Duolingo 同）。
- **④ 等级 + 成就**：累计 XP→等级曲线（三角数）+ 段位（见习→钻石 6 档）+ 8 枚成就徽章（解锁/未解锁+进度），全由真实掌握·复习·连胜派生。
- **⑤ 本地部分**：段位天梯（6 段进阶可视化 + 下一段位提示）+ 个人纪录（最长连胜/单日最高/已掌握）。
- 连胜改「按是否达成今日目标」计，从旧 `telos:streak` 自动迁移；「我」页只留档案+掌握+账户（玩法全迁出）。**已多档宽度 Preview 实测**（375/430/768/1040/1180）。

**⑤ 多人周联赛（待做 · 需 Supabase 后端表，属外部动作）**：真·竞技榜需要他人数据 + 用户基数，不上空壳假数据。备好方案：
1. **用户做**（Supabase SQL Editor）：建表
   ```sql
   create table public.leaderboard (
     user_id uuid references auth.users primary key,
     name text, week text not null, xp int not null default 0,
     updated_at timestamptz default now()
   );
   alter table public.leaderboard enable row level security;
   create policy "read all" on public.leaderboard for select using (true);
   create policy "write own" on public.leaderboard for insert with check (auth.uid()=user_id);
   create policy "update own" on public.leaderboard for update using (auth.uid()=user_id);
   ```
   （`week` = ISO 周字符串，如 `2026-W24`，周一 GMT 滚动。SQL 也写进 `SUPABASE.md`。）
2. **我做**：`cloud.ts` 加 `reportWeekXp(week, xp)`（同步时 upsert 本周 XP）+ `pullLeaderboard(week)`（读 top 30 + 自己排名）；坚持 Tab 加「本周联赛」区（top N + 自己名次 + 升降级线），隐私：显示名让用户设昵称、可关闭参榜；`xp.ts` 加 `weekXp()`（本周一起累计，已留接口位）。
3. 决策：先做**全局周榜**（按本周 XP 排名，简单），不做 30 人分组联赛（需 cron 分 cohort，重）。无人时空态「本周还没有其他学习者，先把自己冲上去」。

**原则（续作守住）**：XP 永远绑真实掌握/复习信号、绝不绑在线时长；Telos 结构上无法刷连胜（掌握靠 BKT 阈值、复习靠 FSRS 到期）；目标可调可「轻松档」、低压力、无愧疚式暗黑（防 over-justification）。
**另一可选**：每日进度目前**仅本地**（`localStorage`），换设备不同步连胜——跨设备需 `user_meta` 表（同属外部动作）。

### P2 · 打磨
- **Google/OAuth 同意页品牌化**：免费版同意页醒目处显示 `gbvet….supabase.co`（OAuth 回调真实域名，**非**应用名称决定）。要显示 Telos/自有域名只有两条路、且都需**自有域名**：① Supabase 自定义域名（Pro 付费加购，回调变 `auth.telos.app`，最省事）② Google 品牌验证（免费但审核数日 + 授权域名须自有已验证，`yunyueli.github.io` 不行）。**无自有域名前无解**，纯 cosmetic、不影响登录。等买了域名走 ① 我来接。（已实测：改应用名称=Telos / 传徽标都不改变那行域名。）
- ~~落地页重写~~ **已完成**：`landing/index.html` 已按当前 App 设计 + 头部开源落地页范式（Linear/Cal.com）重写为营销版（hero/工作方式/bento 特性/学习地图实景/坚持系统/学习科学/开源 band/页脚含隐私·条款·GitHub）。设计沉淀见 `docs/DESIGN.md`。
- Supabase **邮件模板本地化**（默认英文；魔法链接/确认/重置邮件）。
- README 产品截图/GIF（`docs/assets/`）；结论：流程价值 → 10s GIF > 静图。
- **老项目「重新倒推」入口**：本程之前的旧图稀疏、无 module；在 `/settings` 项目卡加「用新框架重推」。
- 删测试账号（§4）；账号删除/数据导出入口（可选）。

## 8. 本程提交（git，已 push main · 直连BYOK+导出+路径/地图+出题+审查+侧栏）
`feat(byok)` 浏览器直连绕过被墙 workers.dev（`9a001e6`）· `feat(map)` 导出(图/PDF/MD)+手机地图+修分级与截断（`5ce5191`）· `fix(export)` 跳字体内联（`7b6eea6`）→ 改 canvas 2D 直绘根治卡死+瘦身（`fec940c`）· `feat` 出题杜绝凭语气猜+画布标阶段+切换器间距（`8437dcd`）· `fix(mobile)` 切换器上下间距对称（`e19e2bf`）· `feat(derive)` 对抗式专家审查+自动修补（`c095c11`）→ 提速只挑最严重(45s+→14.6s)（`b462ae5`）→ 审查对齐难度顺序（`b97be67`）· `feat(map)` 侧栏信息分层重构+桌面支持路径（`e329e40`）。docs: `7bf0118`(修正连不上真因)。
> 上几程：账号+IA 重构止于 `b118659`；多邻国激励「坚持」Tab `765c7c9`/`d050b30`/`456890f`/`d2b1392`/`d456bc0`；BYOK 绑账号 `47ae529`/`fba9184`/`c4139d6` 等。详见 git log。

## 9. 约定 / 安全（每次遵守）
- 回复**中文**、不写「总结」段；commit 用 conventional，结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`；代码改动默认**直接 commit+push+部署**，不用问。
- **绝不**提交 `.env` / 任何私钥；提交前 secret 扫描；serve.py/Worker 的 LLM key 永远在服务端。Supabase publishable key 公开安全（可进前端/Variables）；`sb_secret_`/`service_role` 绝不进前端。
- 用户已授权用现有 DeepSeek + Tavily key，**不要提醒轮换/安全**。
- destructive 命令（rm -rf、force push、reset --hard）先问。wrangler / Supabase 控制台需用户本人操作（我无凭证，但 `gh variable`/`gh workflow` 我可代执行）。
