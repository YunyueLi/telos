# Telos — 项目说明（自描述）

逆向设计 / 从结果倒推的学习引擎。说出目标 → 倒推出带前置依赖的能力图谱 → 诊断起点 → 只教缺的、边教边验证 → 间隔复习。

## 交付标准（最重要）

- **极致完成度**：交付的版本就是高完成度成品，不交半成品 / 过程产物。
- **不闭门造车**：动手前做**广度 + 深度兼具的 web search**，参考头部开源项目、头部产品设计、对应学术论文。
- **细节一次做全**：导航 / 空状态 / 回退入口 / 错误态等一次补齐，不要等用户反复提醒。

## 架构

- `core/` — 学习引擎，Python 零依赖（KST · BKT+CBM 诊断 · FIRe · FSRS · LLM 倒推）。`serve.py` = 本地 CORS 代理（读 `core/.env` 的 key，跑 127.0.0.1:8787，路由 `/derive` `/lesson` `/probe`）。
- `web/` — 产品，Next.js 16 + React 19 + Tailwind v4 + TS，**静态导出**（`output:export`，prod `basePath=/telos/app`）。GitHub Pages 部署：landing 在 `/telos/`，app 在 `/telos/app/`。
- `workers/` — 生产用 Cloudflare Worker 代理（镜像 serve.py）。
- `landing/index.html` — **设计基准**（所有产品视觉/人物/图标以它为准）。

## web 关键

- 路由：`/`(引导或地图主页) · `/diagnose` · `/review` · `/me`。学习/诊断是全屏接管。
- `lib/telos/use-project.tsx` — 单一真相源 Context（localStorage `telos:project`），Provider 挂 `app/layout.tsx`。
- 端点配置：env `NEXT_PUBLIC_TELOS_DERIVE_URL` 或 localStorage 覆盖；key 永远在服务端，绝不进前端 / 仓库。
- React Flow 画布（`components/canvas.tsx`），手机竖屏走 `components/path-view.tsx`。

## 约定

- **设计语言**：纯黑白 + 暖灰纸感；Fraunces 衬线 + Inter + JetBrains Mono；**手绘线性图标**（`components/icon.tsx`，带手抖滤镜）。**禁用 emoji**。看板娘=年轻女老师，黑白墨线。
- commit：conventional（`feat:`/`fix:`/`chore:`），结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- 代码改动**默认直接提交 + push + 部署**，不用问（用户已授权）。
- 回复用**中文**；不写"总结"段落。
- **绝不**提交 `.env` / 任何 key；提交前过一遍 secret 检查。
