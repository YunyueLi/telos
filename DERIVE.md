# 启用「倒推任意目标」

倒推(目标 → 前置知识图谱)需要调用一个 LLM。Telos 走 **BYOK（自带 key）**：

- 用户在应用 **设置 · 接入状态 → AI 引擎** 填自己的 API key（DeepSeek / OpenAI / 任意 OpenAI 兼容）。
- key **只存在用户本机 + 其账号**（Supabase `user_metadata`），随**每次请求**经请求头发往倒推端点；端点**不落盘、不记录**，且 **绝不写进前端构建产物**。
- 倒推的多段编排跑在一个端点上：本地 `core/serve.py`，公开 `workers/derive.js`（Cloudflare Worker）。公开 Worker **无需内置 key**——它用每个请求带来的用户 key。

| 场景 | 端点 | key 来自 |
|---|---|---|
| 本地体验 / CLI / SKILL | `core/serve.py`（零依赖) | 你机器上的 `core/.env` |
| 公开网页(GitHub Pages) | `workers/derive.js`（Cloudflare Worker） | **用户请求自带（BYOK）**；私有/自费实例可用 Worker secret 作回退 |

> 安全须知:**任何曾经粘贴/提交到公开处的 key 都视为已泄露,先去控制台作废重建。**
> `core/.env` 已被 `.gitignore` 忽略;私有实例的 Worker key 用 `wrangler secret` 存,不进仓库。

---

## A. 本地体验(最快)

一条命令——装依赖、起「倒推代理 + 网页」、自动开浏览器:

```bash
./start.sh        # 或: make
```

首次会从 `core/.env.example` 生成 `core/.env`;把里面的 `TELOS_LLM_API_KEY` 换成你自己的新 key
(到 [platform.deepseek.com](https://platform.deepseek.com) 拿,便宜),保存后刷新页面即可。
网页在 `http://localhost:3000`,已**零配置**自动连本地代理(`127.0.0.1:8787`),不用设任何环境变量。

> 想手动分开起? `cd core && python3 serve.py`(一个终端)+ `cd web && npm run dev`(另一个),效果相同。

纯命令行也行,不用网页:

```bash
cd core && python3 derive.py "用 Rust 写一个高性能 HTTP 服务器"
```

---

## B. 公开网页(Cloudflare Worker)

Worker 免费额度足够用。默认 **BYOK**：Worker 用每个请求带来的用户 key（不内置、不留存）。
**只有**当你想要一个由你自费、访客零配置的「私有/演示」实例时,才给 Worker 设一个 LLM secret 作回退(下面"可选"步骤)；纯 BYOK 公开实例**不要**设,免得替所有访客买单。

### 最简:一键部署(推荐,无需命令行)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YunyueLi/telos/tree/main/workers)

点按钮 → 用 Cloudflare 账号登录(免费,建议**邮箱+密码**注册,社交登录偶尔串号)→ 它读 `workers/wrangler.toml` 自动建好 Worker,得到一个 `…workers.dev` 地址。**到这一步,纯 BYOK 公开实例就部署好了**(访客自带 key)。

**可选 · 仅当你要做"由你自费、访客零配置"的私有/演示实例**:进该 Worker 的 **Settings → Variables and Secrets**,加 **Secret** 作回退(没填 key 的请求才用它):

| Name(只填名字) | Value(填你的 key) |
|---|---|
| `TELOS_LLM_API_KEY` | 你的 DeepSeek/OpenAI key(`sk-…`) |
| `TELOS_SEARCH_API_KEY` | 可选,Tavily key(`tvly-…`) |

> ⚠️ **常见坑**:Name 框只填 `TELOS_LLM_API_KEY`,Value 框单独填 key——**别把整行 `TELOS_LLM_API_KEY=sk-…` 都塞进 Name**,否则 Worker 读不到(`/health` 会一直 `available:false`)。

### 或:命令行(wrangler)

```bash
cd workers
npx wrangler deploy                          # 部署(首次会让你登录 + 起 workers.dev 子域)
npx wrangler secret put TELOS_LLM_API_KEY    # 提示 Enter a secret value: 时,只粘 key 的值(不要带 KEY= 前缀)
npx wrangler secret put TELOS_SEARCH_API_KEY # 可选:Tavily
```

部署后会得到一个地址,如 `https://telos-derive.<你的子域>.workers.dev`。
倒推端点就是它加 `/derive`。把它接到网页有两种方式:

1. **构建期注入**(让公开站默认可用):在 GitHub Action(`.github/workflows/deploy.yml`)
   的构建步骤加环境变量
   `NEXT_PUBLIC_TELOS_DERIVE_URL=https://telos-derive.xxx.workers.dev/derive`。
   （这个 URL 不是机密,可以公开;真正的 key 在 Worker 里。)
2. **运行时粘贴**:任何访客在「倒推」页底部把上面的 `/derive` 地址填进去保存即可(存在各自浏览器的 localStorage)。

健康检查:`curl https://telos-derive.xxx.workers.dev/health` → `{"ok":true,"available":true,...}`

### 防盗刷(建议)
Worker 暴露在公网,别人拿到 URL 也能调用、消耗你的 LLM 额度。建议:
- 在 `wrangler.toml` 把 `ALLOW_ORIGIN` 收紧到你的站点域名(挡掉浏览器跨域滥用)。
- 在 Cloudflare 控制台给该 Worker 加 **Rate Limiting**,或前面挂 **Turnstile** 人机校验。
- 设 DeepSeek 账户消费上限。

---

## prompt：公开 baseline + 私有增强

倒推 / 微课 / 诊断的全部 prompt 抽在两个**公开 baseline** 文件里（clone / 自部署即用、质量稳定）：

- `core/telos_core/prompts.py` —— 本地 `serve.py` / Python 引擎用（繁版）
- `workers/prompts.js` —— 生产 Cloudflare Worker 用（简版）

两者是**有意的繁简镜像**；`node workers/check-prompt-parity.mjs` 校验关键「铁律」子串在两端在场（改 prompt 后跑一遍，可挂 pre-push / CI）。

**owner 的私有增强（可选）**：持续调优的 prompt 写进 git-ignored 的私有版，公开仓永远只留 baseline——竞品从公开仓只能拿到冻结的 baseline，拿不到你之后的迭代。

- **Worker**：`workers/prompts.private.js`（参考 `prompts.private.js.example`）。`npm run deploy`(= `bash deploy.sh`)部署时用它**临时替换** `prompts.js` 上线、**部署后自动还原**,公开仓不留痕；无私有版则直接用 baseline 部署(`npm run deploy:baseline` 跳过整套逻辑)。
- **Python**：`core/telos_core/prompts_private.py`（自部署 / 自用时覆盖）。

私有增强必须**保留 baseline 的全部铁律**——`check-prompt-parity.mjs` 校验「公开 ⊆ 私有」,`deploy.sh` 上线前自动跑一遍,丢了铁律就部署失败。

---

## 接口约定(两端一致)

`POST /derive`,body `{"goal": "..."}`,返回:

```json
{
  "goal": "…",
  "points": [
    { "id": "py", "name": "Python 基础", "prereqs": [], "isGoal": false, "minutes": 30 },
    { "id": "deploy", "name": "部署上线", "prereqs": ["route","mw"], "isGoal": true, "minutes": 40 }
  ]
}
```

这张图能被网页(`web/lib/telos/engine.ts`)和 Python 引擎(`core/telos_core`)
同一套逻辑消费:诊断 → 学习前沿 → FSRS 复习。

---

## 联网检索(可选):让微课给出真实可点的链接

默认微课的「延伸学习」给的是**平台搜索链接**(点开是 B站/YouTube 的搜索结果页)——
因为让 LLM 自己写 URL 几乎必然幻觉。配上检索后,Telos 会**先真的联网搜**、把真实结果
喂给模型,模型**只能从中挑、用下标引用,绝不编造 URL**(Perplexity 的铁律),前端再渲染成
带 favicon + 域名的**出处卡片**,直达具体视频/文档。

**不配也完全能用**——自动降级回平台搜索链接,不报错。

| provider | 拿 key | 免费额度 | 返回 |
|---|---|---|---|
| `tavily`(推荐) | [tavily.com](https://tavily.com) → API Keys(`tvly-...`) | ~1000 次/月 | 网页(课程/文档/文章) |
| `youtube` | Google Cloud Console → 启用 *YouTube Data API v3* → 凭据 | 1 万配额/日 | 真实视频 |

**本地(serve.py)** — 在 `core/.env` 加:

```bash
TELOS_SEARCH_PROVIDER=tavily
TELOS_SEARCH_API_KEY=tvly-xxxxxxxx
```

改完**重启 serve.py** 即生效。

**线上(Worker)** — key 同样只放服务端:

```bash
cd workers
wrangler secret put TELOS_SEARCH_API_KEY    # 粘贴 tvly-... / YouTube key
# provider 写进 wrangler.toml 的 [vars]:  TELOS_SEARCH_PROVIDER = "tavily"
wrangler deploy
```

> 检索 key 和 LLM key 一样,**永远在服务端,绝不进前端代码或仓库**。
