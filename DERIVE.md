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

```bash
cd core
cp .env.example .env          # 首次:把 TELOS_LLM_API_KEY 改成你自己的新 key
python3 serve.py              # 监听 127.0.0.1:8787
```

另开一个终端跑网页:

```bash
cd web
npm install --legacy-peer-deps
NEXT_PUBLIC_TELOS_DERIVE_URL=http://127.0.0.1:8787/derive npm run dev
```

打开 `http://localhost:3000/derive`,输入任意目标即可。
（或者不设环境变量,直接在「倒推」页底部把端点填成 `http://127.0.0.1:8787/derive` 保存。)

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
