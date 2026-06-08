# Telos · 交接文档（续作必读）

> 给下一个会话/设备：先读这份，再读 `README.md` / `CLAUDE.md` / `SUPABASE.md` / `docs/STRATEGY.md`。
> 本版覆盖到「账号系统上线 + 顶栏/账户 IA 重构」之后（commit `b118659`）。

---

## 0. 一句话现状

倒推已是**多段层级化**（30–80 节点）、模型 **deepseek-v4-pro 非思考**；**账号 + 跨设备同步已真上线并实测通过**（Supabase）；顶栏/设置/账户的信息架构做了多轮重构。**唯一卡住线上核心的是：线上没有倒推端点（Worker 未部署）——访客能登录但不能倒推。见 P0。**

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
| **倒推 / 微课 / 诊断（核心）** | ❌ **不可用** —— 线上无 LLM 端点（`NEXT_PUBLIC_TELOS_DERIVE_URL` 未设、Worker 未部署）。访客「接入状态」显示 AI 引擎未连接，输目标无法倒推。**这是 P0。**|
| Google / GitHub 登录 | ❌ 按钮在，但 Supabase 未开 provider（点了报未启用）|
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
- **.env\* 全被 gitignore**（含 `.env.local.example`）→ 环境变量文档写在 `SUPABASE.md`，别建 .example。
- **设计语言**：纯黑白+暖灰纸感；Fraunces+Inter+JetBrains Mono；手绘线性图标（`sketch-defs.tsx` 的 `#i-<name>` + `icon.tsx` IconName）；**禁 emoji**；看板娘黑白墨线。
- **静态导出**：`output:export`，prod `basePath=/telos/app`；`lib/base.ts` 的 `BASE`/`asset()` 给裸 `<img>`/href 用。

## 7. 后续工作（按优先级 · 续作主看这里）

### P0 · 让线上能倒推（当前唯一卡核心的事）
线上没有 LLM 端点 → 访客登录后无法倒推/学习。要部署 Cloudflare Worker 并接线：
1. **用户做**：`cd workers && wrangler login && wrangler deploy` → 得 `https://telos-derive.<子域>.workers.dev`。设密钥：`wrangler secret put TELOS_LLM_API_KEY`（DeepSeek），可选 `wrangler secret put TELOS_SEARCH_API_KEY`（Tavily）。`wrangler.toml` 已含 `TELOS_LLM_MODEL=deepseek-v4-pro`。
2. **我做**：`gh variable set NEXT_PUBLIC_TELOS_DERIVE_URL --body "https://…workers.dev/derive"` → `gh workflow run deploy.yml`；并把 `workers/wrangler.toml` 的 `ALLOW_ORIGIN` 收紧到 `https://yunyueli.github.io`。验证：线上「接入状态」AI 引擎变已连接、输目标能倒推 30–80 节点。
> 用户偏非技术；wrangler 比 Supabase 更硬核，需手把手（参照本程 Supabase 的「让用户截图、我逐步指」节奏）。或评估改用 Supabase Edge Function 托管倒推（备选）。

### P1 · 额外登录方式（可选 · 云同步本身已完成，与下列无关）
> ⚠️ 别误会：**邮箱+密码登录已可用 → 跨设备同步随之已完整可用并实测通过**。同步对任何已登录用户都生效，与登录方式无关。下列只是让「魔法链接 / Google / GitHub」这些*别的登录入口*也能用。
- **Redirect URLs**（Supabase → Authentication → URL Configuration）：加 `http://localhost:3000/account/` + `https://yunyueli.github.io/telos/app/account/`，Site URL 设 `https://yunyueli.github.io/telos/app/`。**魔法链接/邮件确认/OAuth 回跳依赖它**（密码登录因 autoconfirm=on 已能用，但魔法链接点开会落到默认页）。
- **Google / GitHub OAuth**：Google Cloud / GitHub 建 OAuth 应用，回调 `https://gbvetfyudlbdiydapipr.supabase.co/auth/v1/callback`，client id/secret 填进 Supabase provider。登录页按钮已就绪，开了即生效。
- 密码重置：`resetPasswordForEmail` 已接（「忘记密码」），同样需 Redirect URLs + 邮件模板。

### P1 · 多邻国式激励系统（用户点过名，勿再漏）
现有 v1：XP（`xp.ts` `computeXp`，绑真实学习信号）+ 连胜（`getStreak/touchStreak`），仅顶栏/「我」展示数字。要做（按子项）：① 每日目标（今天学 N / 得 N XP + 进度环 + 完成动效）② 连续打卡日历（~30 天格子）③ 断签保护（1–2 freeze）④ 等级/成就徽章 ⑤（后置）排行榜。原则：domain **D 动作/F 习惯**本就是「打卡而非遗忘曲线」要打通；XP 永远绑真实学习信号、绝不绑在线时长。先做 ①②③。

### P2 · 打磨
- Supabase **邮件模板本地化**（默认英文；魔法链接/确认/重置邮件）。
- README 产品截图/GIF（`docs/assets/`）；结论：流程价值 → 10s GIF > 静图。
- **老项目「重新倒推」入口**：本程之前的旧图稀疏、无 module；在 `/settings` 项目卡加「用新框架重推」。
- 删测试账号（§4）；账号删除/数据导出入口（可选）。

## 8. 本程提交（git，已 push main）
`fix(map)` CTA flex 截断 · `feat(settings)` 独立 /settings · `fix(settings)` 单列+备份归位 · `fix(nav)` 设置入口 · `fix(nav)` 顶栏三段重排 · `feat(switcher)` 项目切换器 · `fix(switcher)` 分面单行 · `feat(auth)` Supabase 账号+同步 · `feat(derive)` 分阶段进度 · `feat(ui)` 自定义下拉+达标线+折叠 · `feat(settings)` 接入状态重构 · `feat(settings)` 同步并入接入状态 · `feat(ui)` 账户 IA 重构 · `fix(mobile)` 去齿轮 · `fix(mobile)` 三段真居中（`b118659`）。

## 9. 约定 / 安全（每次遵守）
- 回复**中文**、不写「总结」段；commit 用 conventional，结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`；代码改动默认**直接 commit+push+部署**，不用问。
- **绝不**提交 `.env` / 任何私钥；提交前 secret 扫描；serve.py/Worker 的 LLM key 永远在服务端。Supabase publishable key 公开安全（可进前端/Variables）；`sb_secret_`/`service_role` 绝不进前端。
- 用户已授权用现有 DeepSeek + Tavily key，**不要提醒轮换/安全**。
- destructive 命令（rm -rf、force push、reset --hard）先问。wrangler / Supabase 控制台需用户本人操作（我无凭证，但 `gh variable`/`gh workflow` 我可代执行）。
