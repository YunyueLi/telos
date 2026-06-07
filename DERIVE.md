# 启用「倒推任意目标」

倒推(目标 → 前置知识图谱)需要调用一个 LLM。**API key 必须放在服务端**——
静态网页的前端代码是公开的,key 写进去等于公开泄露。所以有两条路径:

| 场景 | 用什么 | key 放在哪 |
|---|---|---|
| 本地体验 / CLI / SKILL | `core/serve.py`（零依赖) | 你机器上的 `core/.env` |
| 公开网页(GitHub Pages) | `workers/derive.js`（Cloudflare Worker) | Worker 的 secret |

> 安全须知:**任何曾经粘贴/提交到公开处的 key 都视为已泄露,先去控制台作废重建。**
> `core/.env` 已被 `.gitignore` 忽略;Worker 的 key 用 `wrangler secret` 存,不进仓库。

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

Worker 免费额度足够 Demo 用。**key 只存在 Worker 后端,前端只知道 Worker 的 URL。**

```bash
npm install -g wrangler
cd workers
wrangler login
wrangler secret put TELOS_LLM_API_KEY      # 粘贴你自己的新 key（不会进仓库）
# 可选:换模型 / 收紧来源
#   wrangler secret put TELOS_LLM_MODEL     # 或改 wrangler.toml 里的 [vars]
wrangler deploy
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
