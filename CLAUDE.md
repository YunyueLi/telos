# Telos — 项目说明（自描述）

逆向设计 / 从结果倒推的学习引擎。说出目标 → 倒推出带前置依赖的能力图谱 → 诊断起点 → 只教缺的、边教边验证 → 间隔复习。

## 交付标准（最重要）

- **极致完成度**：交付的版本就是高完成度成品，不交半成品 / 过程产物。
- **不闭门造车**：动手前做**广度 + 深度兼具的 web search**，参考头部开源项目、头部产品设计、对应学术论文。
- **细节一次做全**：导航 / 空状态 / 回退入口 / 错误态等一次补齐，不要等用户反复提醒。

## 架构

- `core/` — 学习引擎，Python 零依赖（KST · BKT+CBM 诊断 · FIRe · FSRS · LLM 倒推）。`serve.py` = 本地 CORS 代理（读 `core/.env` 的 key，跑 127.0.0.1:8787，路由 `/derive` `/lesson` `/probe`）。
- `web/` — 产品，Next.js 16 + React 19 + Tailwind v4 + TS，**静态导出**（`output:export`，prod `basePath=/telos/app`）。GitHub Pages 部署：landing 在 `/telos/`，app 在 `/telos/app/`。
- `workers/` — 生产用 Cloudflare Worker 代理（镜像 serve.py）+ **付费 webhook `/billing/webhook`**（验签后用 service_role 写 Supabase `app_metadata.telos_pro`；service_role/webhook secret 只存 wrangler secret，绝不进前端/仓库）。
- **付费（Telos Pro）**：配置单点 `web/lib/telos/billing-config.ts`（服务商/价格/checkout/限额/托管配额/加油包）；权益 `web/lib/telos/billing.ts`（`isPro()`/`refreshEntitlement()`，真源=app_metadata）。免费=BYOK 无限+托管试用 3 次+3 项目+水印导出；Pro=托管 AI 月度配额（30 倒推+600 微课）+无限项目+无水印+Anki 导出+全部官方模板。定价页 `/pro`。
- **托管 AI**：无 BYOK 的请求带 Supabase token → Worker `hostedGate` 验身份 + KV(`TELOS_USAGE`) 计量（月度/试用/加油包 `pack_d10|pack_l200`）；BYOK 请求旁路计量零成本。错误码 NEED_LOGIN/HOSTED_TRIAL_USED/HOSTED_QUOTA/NO_HOSTED 前端本地化。买断(lifetime)**不含**托管用量。
- **模板店内容安全**：付费图谱内容（desc/drill/benchmark）**绝不进前端/仓库**（防白嫖）——前端 `templates.ts` 只留 meta+脱敏大纲，完整 points 存 KV `tpl:<id>`（私有母版 `workers/templates-private.json` **git-ignored**，`workers/seed-templates.sh` 灌入），Worker `POST /template` 鉴权（`verifyUser`→已购 `app_metadata.telos_templates` 或 Pro）后下发，前端 `derive.ts fetchTemplatePoints` 拉取。免费模板（科二）内容内嵌前端。Pro=全解锁，非 Pro 可单买。
- **设计基准 = 实际 App（`/telos/app/`，即 `web/`）**，所有产品视觉/品牌/图标以它为准。`landing/index.html` **已过时**，勿再当基准；待重写以对齐 App（见 HANDOFF P2）。

## web 关键

- 路由：`/`(引导或地图主页) · `/diagnose` · `/review` · `/streak`(坚持/激励) · `/me` · `/settings` · `/account`(登录) · `/privacy` · `/terms`。学习/诊断是全屏接管。
- `lib/telos/use-project.tsx` — 单一真相源 Context（localStorage `telos:project`），Provider 挂 `app/layout.tsx`。
- 端点配置：env `NEXT_PUBLIC_TELOS_DERIVE_URL` 或 localStorage 覆盖；key 永远在服务端，绝不进前端 / 仓库。
- React Flow 画布（`components/canvas.tsx`），手机竖屏走 `components/path-view.tsx`。

## 约定

- **设计语言**：纯黑白 + 暖灰纸感；Fraunces 衬线 + Inter + JetBrains Mono；**手绘线性图标**（`components/icon.tsx`，带手抖滤镜）。**禁用 emoji**。看板娘=年轻女老师，黑白墨线。**完整设计参考见 `docs/DESIGN.md`**（色彩/字体/图标/状态/组件/游戏化/动效/IA 全量规范）。
- commit：conventional（`feat:`/`fix:`/`chore:`），结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 代码改动**默认直接提交 + push + 部署**，不用问（用户已授权）。
- 回复用**中文**；不写"总结"段落。
- **绝不**提交 `.env` / 任何 key；提交前过一遍 secret 检查。
