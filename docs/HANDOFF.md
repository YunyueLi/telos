# Telos · 交接文档（续作必读）

> 给下一个会话/设备：先读这份，再读 `README.md` / `CLAUDE.md` / `SUPABASE.md` / `docs/STRATEGY.md`。
> 本版覆盖到「账号系统上线 + 顶栏/账户 IA 重构」之后（commit `b118659`）。

---

## 0. 一句话现状

倒推已是**多段层级化**（30–80 节点）、模型 **deepseek-v4-pro 非思考**；**账号 + 跨设备同步已真上线并实测通过**（Supabase）；顶栏/设置/账户的信息架构做了多轮重构。**线上倒推端点已部署并打通**——Cloudflare Worker `telos-derive.xuanlyy.workers.dev`（deepseek-v4-pro + tavily，CORS 收紧到 github.io），`NEXT_PUBLIC_TELOS_DERIVE_URL` 已注入构建，端到端实测输目标倒推 48 节点。**线上核心（注册/登录/倒推/学习/同步）现已全部可用。**

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

## 2. 线上现状（GitHub Pages：landing `/telos/`，app `/telos/app/`）

| 能力 | 线上状态 |
|---|---|
| 账号登录/注册（邮箱+密码、魔法链接） | ✅ 可用（Supabase 变量已注入构建，实测通过）|
| 跨设备同步 | ✅ 可用（`projects` 表 + RLS）|
| **倒推 / 微课 / 诊断（核心）** | ✅ **可用** —— Cloudflare Worker `telos-derive.xuanlyy.workers.dev` 已部署（密钥已设 `available:true`、CORS=github.io），`NEXT_PUBLIC_TELOS_DERIVE_URL` 已注入构建。实测输目标倒推 48 节点。|
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
- **未配（待办，见 P1）**：Google/GitHub provider（`google=false, github=false`）；**Redirect URLs 未加**（魔法链接 / OAuth / 邮件确认回跳要用——加 `http://localhost:3000/account/` 和 `https://yunyueli.github.io/telos/app/account/`）。
- **测试账号待清**：`telos.e2e.check@gmail.com`、`telos.iatest@gmail.com`（实测建的，项目数据已删）。可在 Authentication → Users 删掉。

## 5. 架构新增 + 关键文件

- `web/lib/telos/supabase.ts` — 客户端单例（PKCE/detectSessionInUrl/persist），`cloudConfigured()`。
- `web/lib/telos/auth.tsx` — `AuthProvider`/`useAuth`（session/user + signInPassword/signUpPassword/signInMagicLink/signInOAuth/resetPassword/signOut）。挂在 `app/layout.tsx`（Lang>Auth>Project）。
- `web/lib/telos/cloud.ts` — SDK 同步：`pullProjects/pushProject/deleteRemoteProject`（表 `projects(user_id,id,data,updated_at)`，per-project 最后写入者胜）。
- `web/lib/telos/use-project.tsx` — 集成同步：登录后 `syncNow`（pull+合并+回推）、mutate 即 `pushCloud`、删即 `deleteRemoteProject`；暴露 `cloudOn/syncing/lastSync/syncNow`。
- `web/components/account-menu.tsx`（头像下拉）· `select-menu.tsx`（自定义下拉）· `project-switcher.tsx`（项目切换器）· `endpoint-config.tsx`（接入状态卡 + 高级）· `tier-text.tsx`（达标线分级）。
- 两个倒推后端仍须同步：`core/telos_core/llm.py`（serve.py）与 `workers/derive.js`（Worker）。`/health` 两端都已加 `search` 透出。

## 6. 坑（必读）

- **Turbopack 旧 CSS**：改 globals.css 不生效 → `rm -rf web/.next` + 重启（preview 同理）。
- **preview MCP 与 start.sh 都占 :3000**（互斥）：用 preview 前先停 start.sh；要测倒推/接入状态另起 `（cd core && python3 serve.py）`。`preview_eval` 单次 ≤30s；`preview_resize` 重置 React 状态（localStorage 保留）。
- **Supabase 新 key 体系**：publishable 取代 anon，`supabase-js` 已支持；验证 key：`curl ".../auth/v1/settings" -H "apikey: <key>"`（200=有效，401=错），顺带能看 providers/autoconfirm。
- **i18n**：自研 9 语（`web/lib/telos/i18n-dict.ts`），**加 key 必须补全 9 语**；**重复 key 会让 `next build` TS 报错**（曾踩 common.close）。
- **.gitignore 实际只忽略 `.env` 与 `.env*.local`**——`core/.env.example`、`web/.env.example` **可提交且已在仓库**（`.env.local.example` 这种带 `.local` 的才会被忽略，故 web 模板命名为 `.env.example`）。`start.sh` 首次自动 `cp core/.env.example core/.env`。（旧版误记为"全忽略、别建 .example"，已纠正。）
- **设计语言**：纯黑白+暖灰纸感；Fraunces+Inter+JetBrains Mono；手绘线性图标（`sketch-defs.tsx` 的 `#i-<name>` + `icon.tsx` IconName）；**禁 emoji**；看板娘黑白墨线。
- **静态导出**：`output:export`，prod `basePath=/telos/app`；`lib/base.ts` 的 `BASE`/`asset()` 给裸 `<img>`/href 用。

## 7. 后续工作（按优先级 · 续作主看这里）

### 待办速览

| # | 待办 | 优先级 | 谁做 | 状态 | 能否独立由助手完成 |
|---|---|---|---|---|---|
| 1 | ~~线上倒推（部署 Cloudflare Worker）~~ | ~~P0~~ | 用户 wrangler + 我接线 | **✅ 已完成**（实测倒推 48 节点） | — |
| 2 | 多人周联赛 ⑤（全局周榜） | P1 | 用户建表 → 我接客户端 | 方案就绪，待建表 | 否（需用户建表） |
| 3 | GitHub 登录（魔法链接 + Google 已开） | P1 | 用户 Supabase + GitHub | Google/魔法链接 ✅；剩 GitHub | 否（需用户配置） |
| 4 | 老项目「重新倒推」入口 | P2 | **我** | 未开始 | **是** |
| 5 | 跨设备连胜同步（`user_meta` 表） | P2 | 用户建表 → 我接 | 可选 | 否 |
| 6 | Supabase 邮件模板本地化 | P2 | 用户 Supabase | 可选 | 否 |
| 7 | README 截图/GIF · 删测试账号 | P2 | 我 / 用户 | 杂项 | 部分 |

> 我能**完全独立**推进的只有 #4（老项目重新倒推入口）；其余都卡在需要用户做的外部动作（建表 / OAuth 控制台）。

### P0 · 让线上能倒推 —— ✅ 已完成
- **Worker**：`telos-derive.xuanlyy.workers.dev`（用户 Cloudflare 账号 `xuanlyy`，`npx wrangler deploy` 部署；`wrangler.toml` name=telos-derive、model=deepseek-v4-pro、provider=tavily、`ALLOW_ORIGIN=https://yunyueli.github.io`）。
- **密钥**（用户 `wrangler secret put` 设，**值只填 value 不要带 `KEY=` 前缀**——曾踩坑把整行当 name）：`TELOS_LLM_API_KEY`(DeepSeek) + `TELOS_SEARCH_API_KEY`(Tavily)。`/health` → `available:true`、`search.available:true`。
- **接线**：`gh variable set NEXT_PUBLIC_TELOS_DERIVE_URL https://telos-derive.xuanlyy.workers.dev/derive` + `deploy.yml` build env 已加该行 → 重新部署，线上 JS 已含该 URL。
- **实测**：curl POST /derive 返回 48 节点；CORS 预检 github.io → 204 放行。端点路由：`/derive /lesson /probe /title /health`（前端把 `/derive` 替换出其余）。
- 改 `workers/derive.js` 后用户须重 `npx wrangler deploy`（助手可代跑 deploy，但 secret 须用户本人）。

### P1 · GitHub 登录（魔法链接 + Google 已开）
> 云同步对任何已登录用户都生效，与登录方式无关。邮箱+密码 / 魔法链接 / Google 均已可用。
- **已完成**：Redirect URLs（`http://localhost:3000/account/` + `https://yunyueli.github.io/telos/app/account/`，Site URL `…/telos/app/`）；Google OAuth（client 配进 Supabase，provider 开，可登）。
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

## 8. 本程提交（git，已 push main · 多邻国式激励系统）
`feat(gamify)` 每日目标+打卡日历+断签保护 ①②③（`765c7c9`）· `feat(streak)` 玩法独立成「坚持」Tab+全屏响应式（`d050b30`）· `feat(streak)` 打卡日历改月历翻页+真实日期（`456890f`）· `feat(streak)` 等级+段位+成就徽章+个人纪录 ④（`d2b1392`）· `feat(streak)` 段位天梯 ⑤本地+多人周联赛后端方案（`d456bc0`）。
> 上一程（账号+IA 重构）止于 `b118659`，详见 git log。

## 9. 约定 / 安全（每次遵守）
- 回复**中文**、不写「总结」段；commit 用 conventional，结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`；代码改动默认**直接 commit+push+部署**，不用问。
- **绝不**提交 `.env` / 任何私钥；提交前 secret 扫描；serve.py/Worker 的 LLM key 永远在服务端。Supabase publishable key 公开安全（可进前端/Variables）；`sb_secret_`/`service_role` 绝不进前端。
- 用户已授权用现有 DeepSeek + Tavily key，**不要提醒轮换/安全**。
- destructive 命令（rm -rf、force push、reset --hard）先问。wrangler / Supabase 控制台需用户本人操作（我无凭证，但 `gh variable`/`gh workflow` 我可代执行）。
