# Telos · 新电脑完整迁移指南

> **一句话**：`git clone` 只拿到**代码**。真正要手动补齐的是三类东西——
> ① 不在 Git 里的**密钥 / 私有内容**；② 外部**服务账号接入**；③ **部署链路**（Pages + Cloudflare Worker + DNS）。
> 本文逐项覆盖，最后附 [§7 端到端验证清单](#7-端到端验证清单)。**全程不需要把任何 key 写进仓库**（`.gitignore` 已挡）。

---

## 0. 架构速览（迁移前先有全局）

| 部分 | 是什么 | 部署在哪 |
|---|---|---|
| `core/` | 学习引擎（Python 零依赖：KST · BKT+CBM · FIRe · FSRS · LLM 倒推）+ `serve.py` 本地 CORS 代理 | 本机跑（`127.0.0.1:8787`） |
| `web/` | 产品 App（Next.js 16 + React 19 + Tailwind v4，**静态导出** `output:export`，prod `basePath=/app`） | GitHub Pages → `telos.ungetsu.net/app/` |
| `landing/` | 营销落地页（单文件 HTML） | GitHub Pages → `telos.ungetsu.net/`（根） |
| `workers/` | 生产用 Cloudflare Worker（倒推代理，镜像 serve.py）+ 计费 webhook | Cloudflare → `telos-api.ungetsu.net` |

线上：`telos.ungetsu.net`（landing `/` + app `/app/`），`telos-api.ungetsu.net`（Worker）。
旧 `*.github.io/telos/*` 由 GitHub 自动 301 过来。

---

## 1. 前置工具（新机先装）

| 工具 | 版本 / 说明 |
|---|---|
| Git | 任意近期版本；GitHub 账号 **YunyueLi** 对 repo 有推送权 |
| Node | **≥ 22**（Pages 构建用 22；旧机为 v24，均可）+ npm |
| Python | **3（≥3.10）**；`core` 零依赖，`serve.py` 仅用标准库 |
| wrangler | **不用单独装**，走 `npx wrangler …`（随 npm） |
| 可选 · gh CLI | 看 Actions / 开 PR |
| 可选 · jq | 仅「灌付费模板进 KV」(`seed-templates.sh`) 需要 |
| 可选 · 图片处理 venv | 仅重新抠图/转 WebP 立绘时需要（PIL + numpy + scipy，临时 `python3 -m venv`，非常规开发） |

---

## 2. 克隆代码

```bash
git clone https://github.com/YunyueLi/telos.git
cd telos
npm --prefix web install --legacy-peer-deps   # web 依赖（注意 --legacy-peer-deps，与 Pages 一致）
```

`core` 无需装依赖（零依赖）。`workers` 的 wrangler 走 npx，也无需预装。

---

## 3.【最关键】不在 Git 里、必须单独迁移的东西

这些被 `.gitignore` 排除，**clone 不会带过来**，新机必须从旧机拷贝或从服务端重建。

| 文件 / 位置 | 内容 | 怎么拿到新机 | 不补的后果 |
|---|---|---|---|
| `core/.env` | 本地引擎密钥（见下方变量名） | 从旧机拷；或照 `core/.env.example` 重填 | 本地倒推 / 联网搜索不可用 |
| `web/.env.local` | 前端 Supabase 公开配置（见下方） | 从旧机拷；或从 Supabase 面板取 | 本地登录 / 跨设备同步不可用 |
| `workers/templates-private.json` | **付费模板内容母版**（owner 私有，灌进 KV 下发） | 从旧机拷 | 付费模板无法 `seed` 进 KV，已购用户拉不到内容 |
| `workers/prompts.private.js` | 私有调优 prompt（**本机当前没有**） | 旧机有就拷；没有则 `deploy.sh` 自动用公开 baseline，可正常上线 | 无（缺则用公开 baseline，质量略降） |
| `.source-assets/`（可选） | 高清原图母版 | 旧机拷；仓库已含优化版 webp，缺也不影响线上 | 无 |
| `~/.claude/CLAUDE.md`（**个人配置，非本项目**） | 你的 Claude Code 全局偏好 | 走你的 `clauderoam` 仓库（`git clone` + symlink，或 `clauderoam` 工具） | 不影响项目，仅影响 AI 协作习惯 |

**变量名清单（只列名、不含值——值从旧机/服务端取）：**

```
# core/.env  —— 本地引擎（serve.py 读取）
TELOS_LLM_API_KEY        # DeepSeek API key（真·密钥）
TELOS_LLM_BASE_URL       # https://api.deepseek.com
TELOS_LLM_MODEL          # deepseek-v4-pro
TELOS_SEARCH_PROVIDER    # tavily
TELOS_SEARCH_API_KEY     # Tavily API key（真·密钥）

# web/.env.local  —— 前端构建/本地（Next.js 读取）
NEXT_PUBLIC_SUPABASE_URL        # https://gbvetfyudlbdiydapipr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key（公开值，受 RLS 保护）
# 可选：NEXT_PUBLIC_TELOS_DERIVE_URL  本地可设 http://127.0.0.1:8787/derive 走 serve.py
```

> **红线**：以上密钥**绝不**提交进仓库；提交前过一遍 secret 检查。`core/.env.example` 是 `core/.env` 的模板。

---

## 4. 外部服务 / 账号接入（新机要能登进这些）

这些服务的数据 / 配置都在**云端**，换电脑本身不丢——只要新机能登录管理。

| 服务 | 标识 | 用途 | 新机怎么接 |
|---|---|---|---|
| **GitHub** | `YunyueLi/telos`（分支 `main`） | 代码 + push 触发 Pages 部署 | 配 git 凭据 / `gh auth login` |
| **Cloudflare** | 账号 `xuanlyy@gmail.com`（Account ID `d84554e501690d4644c0e65264d449ea`） | Worker 部署 + `ungetsu.net` DNS + KV 计量 | `npx wrangler login` |
| **Supabase** | 项目 ref `gbvetfyudlbdiydapipr` | 账号登录 / 跨设备同步 / 计费写 app_metadata | 面板已配好，无需重建；登录管理即可（详见 `SUPABASE.md`） |
| **DeepSeek** | LLM provider | 倒推 / 微课 / 诊断 | key 在 `core/.env` + CF secret |
| **Tavily** | 搜索 provider | 倒推时联网背景检索 | key 在 `core/.env` + CF secret |
| **Creem** | `BILLING_PROVIDER=creem` | Telos Pro 计费 webhook | 面板配好；webhook secret 是 CF secret |

---

## 5. 本地跑起来

```bash
# ① 本地引擎代理（读 core/.env，监听 127.0.0.1:8787）
cd core && python3 serve.py
#   自检： curl http://127.0.0.1:8787/health   → {"ok":true,"available":true,...}

# ② 前端开发服务器（另开一个终端）
npm --prefix web run dev      # http://localhost:3000
#   注意：prod 才有 basePath=/app；dev 在根路径。
```

**本地直连倒推**：web 通过 `core/.env` 的 key 走 `serve.py`。让前端指向本地端点，二选一：
- 构建/启动前设 `NEXT_PUBLIC_TELOS_DERIVE_URL=http://127.0.0.1:8787/derive`；或
- 浏览器 localStorage 覆盖 `telos:derive-url = http://127.0.0.1:8787/derive`（localhost 下覆盖优先）。

冒烟：`/health` ok → 打开引导页输一个目标 → 能流式倒推出图谱即通。

---

## 6. 构建与部署

### 6.1 Web + Landing → GitHub Pages（**自动**，push 即部署）

- 触发：push 到 `main` → `.github/workflows/deploy.yml`：Node 22 → `npm ci --legacy-peer-deps` → `npm run build`（`web/out`）→ 拼站（`landing/.`→根、`web/out/.`→`/app`、写 `CNAME telos.ungetsu.net`）→ 推到 `gh-pages` 分支。
- **依赖 GitHub 仓库 Variables**（Settings → Secrets and variables → **Actions → Variables**），这三项决定线上能否登录/倒推：
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  NEXT_PUBLIC_TELOS_DERIVE_URL    # = https://telos-api.ungetsu.net/derive
  ```
  > 这些在**仓库上**、跨电脑不丢；但若换/重建仓库（或 fork）务必重新添加，否则线上无法登录/倒推。
- **新机无需本地构建即可部署**——`git push` 就触发 Action。本地构建只用于自检：`npm --prefix web run build`。

### 6.2 Worker → Cloudflare（**手动** `wrangler deploy`）

```bash
npx wrangler login            # 登录 Cloudflare（xuanlyy 账号）
cd workers
./deploy.sh                   # = npm run deploy；有 prompts.private.js 则临时换上、部署后还原，否则用公开 baseline
```

- **Worker secrets**（存在 Cloudflare 端，跨电脑不丢；仅当**换账号 / 新建 Worker**时才需重设）：
  ```bash
  # cd workers，逐个设置（值从旧机 core/.env 与 Supabase/Creem 面板取）：
  npx wrangler secret put TELOS_LLM_API_KEY
  npx wrangler secret put TELOS_SEARCH_API_KEY
  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY     # service_role（高权限，仅在 Worker 用）
  npx wrangler secret put BILLING_WEBHOOK_SECRET
  ```
  其余配置（base/model/search provider/Supabase URL+anon/计费/配额）是**非密** `[vars]`，已在 `workers/wrangler.toml` 里、随仓库走。
- **KV 计量表**：`TELOS_USAGE`（id `a8443863386d445d8dbdcadf6dfab19c`，已在 `wrangler.toml`）。换账号才需 `npx wrangler kv namespace create TELOS_USAGE` 并回填新 id。
- **付费模板灌 KV**（需 `templates-private.json` + `jq`）：`cd workers && ./seed-templates.sh`（内容上新/改动后重跑）。
- **自定义域**：`telos-api.ungetsu.net`（`custom_domain`）。deploy 时 wrangler 自动建 DNS + 证书，**前提是 `ungetsu.net` 在该 Cloudflare 账号**。

### 6.3 DNS / 域名

`ungetsu.net` 托管在 Cloudflare（`xuanlyy` 账号）：Pages 走 `CNAME telos.ungetsu.net`，Worker 走 route `telos-api.ungetsu.net`。换 Cloudflare 账号需先把域名迁过去。

> ⚠️ `*.workers.dev` 在中国大陆被墙——所以生产必须走自有域 `telos-api.ungetsu.net`（已配）。

---

## 7. 端到端验证清单

迁移完成后逐项打勾：

- [ ] `git clone` + 能 `git push`（GitHub 凭据 OK）
- [ ] `core/.env`、`web/.env.local`、`workers/templates-private.json` 已补齐（[§3](#3最关键不在-git-里必须单独迁移的东西)）
- [ ] `cd core && python3 serve.py` → `/health` 返回 `available:true`
- [ ] `npm --prefix web run dev` 起得来，本地能倒推出图
- [ ] `npm --prefix web run build` 绿（TS + 静态导出通过）
- [ ] GitHub 仓库 **Actions Variables** 三项都在（[§6.1](#61-web--landing--github-pages自动push-即部署)）
- [ ] push `main` → Pages Action 绿 → `telos.ungetsu.net` 正常（landing `/` + `/app/`）
- [ ] `npx wrangler login` + `cd workers && ./deploy.sh` → `telos-api.ungetsu.net/health` ok 且能流式倒推
- [ ] `./seed-templates.sh` → 付费模板可鉴权下发
- [ ] 线上登录（Supabase）+ 跨设备同步可用

---

## 8. 易踩坑（本项目历史经验，少走弯路）

- **`*.workers.dev` 被墙** → 生产走自有域 `telos-api.ungetsu.net`（前端有 BYOK 浏览器直连兜底）。
- **`serve.py` 端口 8787 被旧进程占住** → `lsof -ti tcp:8787 | xargs kill -9` 再起；否则新进程 `Address already in use` 静默跑旧代码。
- **dev 模式 CSS 缓存顽固**（Turbopack/`globals.css`）→ 验证视觉改动用「`build` + 静态托管」而非 dev server。
- **prod `basePath=/app`，dev 在根**；页面内链接用相对路径 `app/…`。
- **CSS / 注释里的非 ASCII 符号（⊕ 等）会被 Lightning CSS 静默丢掉整段规则**，构建仍绿 → 注释只用 ASCII（中文 OK）。
- **`<html>` 的 `overflow` 写进 `globals.css` 会被静默丢弃** → 写到 layout 的 `<html>` 内联 style。
- **密钥绝不进仓库**；面向学习者的 UI 绝不暴露 SQL / 后台 / Supabase / 报错码。

---

## 9. 仓库内已有的参考文档（迁移后深入看）

| 文档 | 内容 |
|---|---|
| `CLAUDE.md` | **项目自描述（最权威）**：架构、付费、书斋形象经济、约定 |
| `SUPABASE.md` | 账号 / 同步 / RLS / 部署配置细节 |
| `docs/HANDOFF.md` | 线上现状、已完成 / 待办、历史决策 |
| `docs/DESIGN.md` | 设计语言全量规范（色彩 / 字体 / 图标 / 组件 / 游戏化 / IA） |
| `docs/IMAGE-PROMPTS.md` | 看板娘 / 印章 / 文房立绘生成 prompt + 接入约定 |
| `docs/ROADMAP.md` · `docs/STRATEGY.md` · `docs/SYNERGY.md` | 路线 / 策略 / 与 Greenroom 协同 |
| `DERIVE.md` · `core/README.md` · `CHANGELOG.md` | 倒推引擎说明 / 引擎自述 / 变更日志 |
