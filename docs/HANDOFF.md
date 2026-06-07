# Telos · 交接文档（续作必读）

> 给下一个会话/设备：先读这份，再读 `README.md` / `CLAUDE.md` / `docs/STRATEGY.md`。
> 最近一次更新：本会话完成「知识框架重构 + v4-pro + 独立设置页」后。

---

## 0. 一句话现状

倒推已从「单发 ~16 节点」升级为**多段层级化**（按模块组织的 30–80 节点）、模型切到 **deepseek-v4-pro 非思考**、新增**独立 /settings 页**、地图右栏独立滚动、倒推显示实时耗时。**唯一卡住线上的是 Worker 未部署 + 未接线（见 P0）。** 本地 `./start.sh` 一切就绪。

## 1. 怎么跑（每次新会话先做）

```bash
./start.sh          # 或 make —— 起 serve.py(:8787) + web(:3000) + 开浏览器；Ctrl-C 收尾
make test           # 引擎测试（应 21 passed）
npm --prefix web run build   # 生产构建（静态导出）；改完务必过一遍
```

- `core/.env`（**gitignore，含 key**）已配：`TELOS_LLM_API_KEY`(DeepSeek)、`TELOS_LLM_MODEL=deepseek-v4-pro`、`TELOS_SEARCH_PROVIDER=tavily` + `TELOS_SEARCH_API_KEY`。
- **改了 `core/telos_core/llm.py` 必须重启 serve.py** 才生效（env/模块只加载一次）。
- **Turbopack 旧 CSS 缓存**老毛病：globals.css 改了不生效 → `rm -rf web/.next` 再重启。
- 后台跑的 serve.py/web 进程在 compact/会话结束后会停，重开会话直接再 `./start.sh`。

## 2. 架构关键 + 必须知道的坑

- **两个倒推后端，逻辑必须同步**：本地 `core/telos_core/llm.py`（serve.py 用）；线上 `workers/derive.js`（Cloudflare Worker）。改一个就改另一个，已用相同 mock 验证过两端一致。
- **多段倒推流水线**（两端都实现了）：① 蓝图(`_blueprint`/`blueprint`)判广度档位→定模块大纲+终点目标；② 每模块**并行**展开(`_expand_module`/`parallelExpand`)成可练能力节点；③ 合并(`_assemble`/`assemble`)：去重、跨模块 hint→真边(名字 bigram)、模块按阶段链接、单一目标终点、断环、按广度封顶~80。任一段失败回退单发。
- **节点新增字段** `module` / `moduleTitle`：`core/telos_core/models.py`(KnowledgePoint) + `web/lib/telos/engine.ts`(KnowledgePoint) + `derive.ts`(DerivedPoint, normalize) + serve.py/`toGraph` 都带出。
- **v4-pro 是思考/非思考双模、思考为默认**。倒推/微课/诊断一律非思考：两端对「model 含 v4」的请求体加 `thinking:{type:"disabled"}`（`_thinking_off` / `/v4/i.test`）。非 v4 不加（兼容旧/其它厂商）。型号默认值在 llm.py `_config`、derive.js、`.env.example`、`wrangler.toml` 都是 `deepseek-v4-pro`。
- **诊断选点**：图大时不能逐点出题。`selectProbeTargets(graph,18)`（engine.ts）按「覆盖各模块 + 连通度」选 ~18 个，其余靠 BKT 传播。`diagnose/page.tsx` 已接。
- **前端端点来源**：构建期 `NEXT_PUBLIC_TELOS_DERIVE_URL` > localStorage `telos:derive-url` > localhost 零配置(指向 127.0.0.1:8787)。`web/lib/telos/derive.ts` 的 `getDeriveUrl`。
- **i18n**：自研，9 语言（zh-CN/zh-TW/en/fr/ja/ko/es/ru/de），dict 在 `web/lib/telos/i18n-dict.ts`，**加 key 必须补全 9 语**。组件用 `useT()`，非组件用 `tStatic`。
- **设计语言**：纯黑白+暖灰纸感；Fraunces+Inter+JetBrains Mono；手绘线性图标（sprite 在 `web/components/sketch-defs.tsx`，`#i-<name>` + `web/components/icon.tsx` 的 IconName）；**禁 emoji**；看板娘=年轻女老师黑白墨线（`web/public/portraits/*.png`）。
- **地图右栏独立滚动**（已修）：`.mh{grid-template-rows:minmax(0,1fr);overflow:hidden}` + `.mh-rail{min-height:0}` + `.mh-rail>*{flex:0 0 auto}`。滚右栏地图/整页不动。
- **验证工具坑**：preview MCP 与 `start.sh` 都占 :3000（互斥，验证前先停另一个）；`preview_resize` 会**重置页面 React 状态**（localStorage 保留）；`preview_eval` 单次 ≤30s。

## 3. 后续详细待办（重点 —— 续作主要看这里）

### P0 · 接通线上「立即体验」（当前唯一卡点）
README 已把线上 demo 当主 CTA，但 **`.github/workflows/deploy.yml` 没注入端点**，所以线上前端默认无 `/derive` 端点，访客输目标会提示「请配置端点」。要两步：
1. **用户做**：`cd workers && wrangler login && wrangler deploy` → 得到 `https://telos-derive.<子域>.workers.dev`。（LLM key 之前应已 `wrangler secret put`；没有则 `wrangler secret put TELOS_LLM_API_KEY`。可选 `wrangler secret put TELOS_SEARCH_API_KEY` 上 Tavily。）
2. **我做**：把 `NEXT_PUBLIC_TELOS_DERIVE_URL=https://telos-derive.<子域>.workers.dev/derive` 加进 `deploy.yml` 的「Build static export」步骤（`env:`）；并在 `workers/wrangler.toml` 把 `ALLOW_ORIGIN` 收紧到 `https://yunyueli.github.io`；push → Pages 重建。验证：线上输目标能倒推出 30–80 节点、模型走 v4-pro。

### P1 · 多邻国式 XP / 连续打卡 / 每日目标系统（用户强调过，勿再漏）
现状 v1：XP（`web/lib/telos/xp.ts` 的 `computeXp`，由真实学习信号：掌握增量/准时复习/目标点亮）+ 连胜 streak（`getStreak`/`touchStreak`，localStorage），仅在顶栏(`app-shell.tsx`)与 `/me` 数字展示。**缺整套激励循环**，要做（按优先子项）：
1. **每日目标(daily goal)**：今天学 N 个能力 / 得 N XP；当日进度环 + 完成动效。实现：localStorage 按「日」记当天完成计数（学习判分/复习触发时 +1）；放地图主页 rail 顶部。
2. **连续打卡日历(streak calendar)**：最近 ~30 天格子（当天有学习或复习=打卡），当前连胜高亮、最长连胜。`touchStreak` 已记连胜，需补「每日是否打卡」的历史数组。放 `/me` 或 rail。
3. **断签保护(streak freeze)**：断 1 天不立即清零；可持有 1–2 个 freeze（多邻国机制），用掉则提示。
4. **等级 / 成就徽章**：XP→等级映射 + 升级提示；成就（首个目标点亮 / 7 天连胜 / 掌握 N 个 / 首次满分检验等）。放 `/me`。
5. （后置）排行榜：单机为主，先用「个人历史最佳」代替，或接 Supabase 后再做社交。
要点：domain **D 动作 / F 习惯**本就是「打卡而非遗忘曲线」（见 `docs/STRATEGY.md` 领域分类），打卡系统要和它们打通；XP 永远绑**真实学习信号**、绝不绑在线时长（已是原则）。先做 1+2+3 三件核心，4 随后。

### P2 · 打磨
1. **README 主视觉**：补「目标→地图→微课」产品截图或 GIF（现仅看板娘 `hero.png` 占位）。存 `docs/assets/`，README 顶部引用。研究结论：产品价值是「流程」，10s GIF > 静图（参考 Cal.com/AnythingLLM）。
2. **老项目「重新倒推」入口**：本次之前生成的项目是稀疏、无 module 的旧图。在 `/settings` 项目卡或 `/me` 加「用新框架重推」按钮（调 `derive(project.goal)` 覆盖该项目 points/title）。
3. **倒推 ~80s 进度态**（v4-pro 比 flash 慢）：现仅「已用 N 秒」实时计时（`app/page.tsx` 的 `elapsed`）。可升级为分阶段：「规划模块… / 展开 3/8 模块…」——需后端把阶段进度透出（分步/SSE）或前端按经验时间模拟阶段文案。

### 阻塞 · 需要用户
- **Supabase 云同步**（`SUPABASE.md`）：等用户开免费 Supabase 项目后接账号登录 + 跨设备自动同步。`/settings` 已有「云同步·开发中」入口卡。

## 4. 本会话已交付（git，已 push 到 main）

`fix(lesson)` 微课全出血整合 · `feat(derive)` 层级化多段倒推 · `feat(worker)` 生产 Worker 镜像 · `docs` README+一键 make/start.sh · `feat(llm)` deepseek-v4-pro 非思考 · `fix(ui)` 倒推实时耗时+右栏独立滚动 · `fix(map)` CTA flex 截断 · `feat(settings)` 独立 /settings · `fix(settings)` 单列+备份归位 · `fix(nav)` 设置入口齐高+文字+齿轮。

## 5. 约定 / 安全（每次都遵守）

- 回复**中文**、不写「总结」段；commit 用 conventional，结尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`；代码改动默认**直接 commit+push+部署**，不用问。
- **绝不**提交 `.env` / 任何 key；每次提交前 secret 扫描；serve.py/Worker 的 key 永远在服务端。
- 用户已授权使用现有 DeepSeek key + Tavily key，**不要提醒轮换/安全**。
- Worker 部署需用户的 Cloudflare 登录（我无凭证，不代输）。
