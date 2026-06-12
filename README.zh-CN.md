<div align="center">

<img src="web/public/portraits/hero.png" width="116" alt="Telos" />

# Telos

**说出目标，倒着学会它。**

*说出你想达成的结果 —— Telos 倒推出一张按模块组织的能力地图，诊断你已会的，只教你缺的。*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-111.svg)](LICENSE)
&nbsp;[![Release](https://img.shields.io/github/v/release/YunyueLi/telos?style=flat&color=111&label=Release)](https://github.com/YunyueLi/telos/releases)
&nbsp;[![Stars](https://img.shields.io/github/stars/YunyueLi/telos?style=flat&color=111&label=Stars)](https://github.com/YunyueLi/telos)
&nbsp;[![English](https://img.shields.io/badge/README-English-111.svg)](README.md)

### ▶ [**立即体验**](https://yunyueli.github.io/telos/app/) —— 免安装；自带 key，免费用

<sub>[落地页](https://yunyueli.github.io/telos/) · [自己跑起来](#自己跑起来一条命令) · [工作原理](#工作原理) · [免费与 Pro](#免费与-pro) · [部署自己的](#部署自己的)</sub>

</div>

---

上面的在线版直接在浏览器里跑完整闭环——输入任意目标，看 Telos 倒推出一张完整、分阶段的知识地图。无需安装——登录后绑定一个你自己的 API key（随请求发往端点、不落盘，绑定到你的账号），即可开始；任意设备登录即自动连接，退出登录则本机清除。**「登录即用」的托管 AI**（完全不用 key）正在逐步开放——见[免费与 Pro](#免费与-pro)。

```
目标 ─▶ 倒推 ─▶ 按模块组织的前置依赖地图（30–80 个可练能力）
     ─▶ 诊断你已会的（几道好题） ─▶ 你的学习前沿
     ─▶ 只教缺的（交互式微课） ─▶ 边教边验证 ─▶ 间隔复习 ─▶ 循环
```

## 哪种方式适合你？

| | **在线版（托管）** | **本地跑** | **部署自己的** |
| --- | --- | --- | --- |
| **适合** | 只想学东西 | 试用 / 二次开发 | 自建公开实例 |
| **配置** | 登录 | `git clone` + 1 个 API key + `make` | fork + 一键 Worker |
| **要 key 吗** | 目前要——绑定一次（免 key 托管 AI 逐步开放） | 要（DeepSeek / OpenAI / 兼容） | 要（你的用户各自带） |
| **数据存哪** | 浏览器（+ 可选账号同步） | 你本机 | 用户浏览器 / 你的 Supabase |
| **去哪** | **[打开应用 ▶](https://yunyueli.github.io/telos/app/)** | [↓ 自己跑起来](#自己跑起来一条命令) | [↓ 部署自己的](#部署自己的) |

> 第一次来？**直接[打开在线版](https://yunyueli.github.io/telos/app/)** —— 登录、绑定 key、说个目标，看它倒推出地图。README 余下部分是给「想本地跑 / 自己部署」的人看的。

## 自己跑起来（一条命令）

```bash
git clone https://github.com/YunyueLi/telos && cd telos
make          # 或： ./start.sh
```

就这样。`make` 会从模板生成 `core/.env`（并告诉你去哪拿 key）、首次自动装前端依赖，然后同时起「倒推代理 + 网页」并打开浏览器。网页**零配置**自动连本地代理——不用设环境变量、不用开第二个终端。

> 要 key？Telos 支持任意 **OpenAI 兼容**服务——如 **DeepSeek**（[platform.deepseek.com](https://platform.deepseek.com)）或 OpenAI。拿到 key 粘进 `core/.env` 刷新即可。（也可直接在应用「设置 · 接入状态」粘 key + 端点，连 `.env` 都不用碰。）

| 命令 | 作用 |
| --- | --- |
| `make` / `./start.sh` | 本地跑全部（代理 + 网页），自动开浏览器 |
| `make test` | 跑引擎测试（Python，零依赖） |
| `make build` | 生产构建网页（静态导出） |
| `make help` | 列出所有命令 |

## 现在能用的

- **倒推任意目标**成一张*按模块组织*的能力地图——先用「蓝图」一发定好阶段，再把每个模块并行展开、缝合成一张无环图（按目标广度自适应，通常 **6–9 个阶段、30–80 个可练能力**）。
- **是可练能力，不是知识清单。** 每个节点都是可观测的 *can-do* 能力，带刻意练习 **drill** 和可量化**达标线**（新手 / 进阶 / 精英）——依据刻意练习与 EPA/CEFR/Bloom 胜任力框架。
- **一张真能读的地图。** XMind 式阶段分带 + 带内主干树排版 + 线条分级（圆角主干折线 / 极浅的跨阶段引用线），始终从左往右读；手机竖屏有专属路径视图。
- **自适应起点诊断。** 误解型干扰项选择题 + 信心加权（CBM）折进贝叶斯知识追踪（BKT），在图上用信息增益选题——只问约 14 道好题、其余靠传播推断，取代粗糙的「会 / 不会」。
- **交互式微课。** 预测 → 直觉讲解 → 跟着做 → 自我解释 → 渐隐填空 → 无脚手架检验（掌握闸门）——还给真实可点的优质公开课（可选联网检索，链接绝不幻觉）。
- **间隔复习（FSRS-4.5）。** 学过的进入复习队列；到期卡片按评分重排。
- **六大领域类**（陈述 · 程序 · 创造 · 动作 · 对抗 · 习惯）驱动不同诊断与复习策略——所以它既能学数学、也能学一项运动、还能养成一个习惯。
- **坚持系统**（「坚持」Tab）——每日目标 + 进度环、月历打卡、断签保护、等级段位、成就徽章。全部绑**真实学习信号**（掌握与复习），绝不绑在线时长，并守住内在动机（防暗黑模式）。
- **官方模板店**（`/store`）——人工精修、预校准的图谱一键导入（首发：考研英语一、Python 后端面试、免费的驾照科目二）。付费模板的内容购买后由服务端鉴权下发、不进前端；Pro 解锁全部官方模板。
- **学习成果带得走。** 地图 PNG 导出（Pro 无水印）、**Anki 卡组导出**（官方文本格式，FSRS 在 Anki 里接着排）、项目 100% 完成后的带编号**完课证书**（Pro）。
- **账号与跨设备同步**（可选，Supabase）——邮箱/密码、魔法链接、Google；学习项目与进度跨设备带着走。不登录则一切本地优先，存在浏览器里。
- **9 种语言**，自研 i18n（zh-CN/TW · en · fr · ja · ko · es · ru · de）；日期与相对时间用 `Intl` 本地化。

## 工作原理

Telos 是一个**逆向设计**引擎：你说出结果，它倒推出前置依赖，找到**你**在这张地图上的位置（最近发展区 ZPD），从那里往前教——每一步验证掌握、安排间隔复习让它留得住。

它把整套范式拆成三份可独立使用、可互操作的数据标准：

| 标准 | 作用 |
| --- | --- |
| **Outcome Spec** | 把一句话目标结构化成可倒推的规格 |
| **Knowledge Graph** | 带前置依赖、按阶段分组的「可训练能力」图谱（DAG） |
| **Learner State** | 单写者、可版本化的掌握状态 |

## 免费与 Pro

Telos 开源、**BYOK 优先：自带 key，整个学习闭环永远免费、不限量。** Pro 卖的是省事和成果——绝不卖「锁定」。

| | **免费** | **Pro** —— $2.9/月 · $19/年 · $49 买断 |
| --- | --- | --- |
| 学习引擎（自带 key） | 不限量 | 不限量 |
| **托管 AI**——不用 key，登录即用 | 试用：3 次倒推 · 60 节微课 | 每月 30 次倒推 · 600 节微课，+ 加油包 |
| 学习项目 | 3 个 | 不限 |
| 地图导出 | 带水印 | 无水印 + **Anki 卡组导出** |
| 模板店 | 免费模板 | 解锁全部官方模板 |
| 完课证书 | — | 带编号 PNG |

说明：*买断*含除「托管 AI 配额」外的全部权益（LLM 是持续成本，无法一次买断）。托管 AI 与支付正在公共实例上逐步开放——应用内定价页在 `/pro`，模板店在 `/store`。自部署实例默认**关闭**全部付费逻辑，按需开启（见[部署自己的](#部署自己的)）。

## 配置与 API key

- **在线版（BYOK）：** 登录后在「设置 · 接入状态」点 AI 引擎绑定你自己的 API key——随每次请求发往倒推 Worker（端点不落盘）、绑定到你的账号：任意设备登录即自动连接，退出登录则本机清除。
- **本地：** 在 `core/.env` 放一个 API key（DeepSeek / OpenAI / 任意兼容），或在应用「设置 · 接入状态」粘 key + 端点。**切勿提交 key**——`core/.env` 已被 git 忽略。
- **可选联网检索**（微课给真实可点链接、而非搜索页）：在 `core/.env` 设 `TELOS_SEARCH_PROVIDER=tavily` + key。不配也能用，自动降级。

完整说明（本地 key、Cloudflare Worker、检索 provider、防盗刷）见 **[DERIVE.md](DERIVE.md)**。

## 部署自己的

静态前端（**GitHub Pages**）+ 一个编排多段倒推的 **Cloudflare Worker**——还可选承担托管 AI 计量与付费 webhook。**BYOK** 模式下 Worker 用每个用户自带的 key（随请求传入、不落盘）；私有实例可用你自己的 key 作回退。唯一必需的后端是 Worker，其余都优雅降级。

**1 · 后端 —— 一键，无需命令行：**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YunyueLi/telos/tree/main/workers)

登录 Cloudflare（免费）→ 在该 Worker 的 *Settings → Variables and Secrets* 加一个 Secret **`TELOS_LLM_API_KEY`**（你的 DeepSeek/OpenAI key），得到 `https://telos-derive.<子域>.workers.dev`。

**2 · 前端：** fork 仓库 → GitHub Pages 自动构建。用 Actions **变量** `NEXT_PUBLIC_TELOS_DERIVE_URL` = `…workers.dev/derive` 把站点指过去（或直接在应用里粘 URL，按浏览器存）。

**可选 —— 跳过则自动降级：**

| 加上 | 启用 | 跳过 → 回退 |
| --- | --- | --- |
| Tavily key（Worker secret `TELOS_SEARCH_API_KEY`） | 真实可点的微课链接 | 平台搜索链接 |
| [Supabase](SUPABASE.md) 项目 | 账号 + 跨设备同步 | 本地优先（仅浏览器） |
| Google / GitHub OAuth | 社交登录 | 邮箱 + 魔法链接 |
| KV 命名空间 `TELOS_USAGE`（+ Worker 上的 Supabase vars） | **托管 AI**——用户登录即用你的 key，按账号计量（试用/月度配额、加油包） | 仅 BYOK |
| 支付服务商（Creem / Lemon Squeezy）+ `BILLING_WEBHOOK_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` | **Telos Pro 收款**——订阅、加油包、付费模板，走 `/billing/webhook` | 全员免费版 |

完整步骤（命令行备选、密钥、防盗刷、检索 provider）见 **[DERIVE.md](DERIVE.md)** · 账号与同步见 **[SUPABASE.md](SUPABASE.md)** · 激活清单（托管 AI、支付）见 **[docs/HANDOFF.md](docs/HANDOFF.md)**。

## 目录结构

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `core/` | 学习引擎（Python，零依赖）：KST · BKT+CBM 诊断 · FIRe 学分传播 · FSRS 复习 · 多段 LLM 倒推 | ✅ 测试通过 |
| `web/` | 产品（Next.js + React + Tailwind + TypeScript，静态导出）：地图 · 诊断 · 复习 · 坚持 · 模板店 · Pro · 我/设置 | 🚧 活跃开发 |
| `workers/` | Cloudflare Worker：LLM 代理（`/derive` · `/lesson` · `/probe` · `/title`）+ 托管 AI 门禁与 KV 计量（`/billing/usage`）+ 付费 webhook（`/billing/webhook`） | ✅ |
| `landing/` | 营销落地页（静态 HTML） | ⚠️ 已过时——待重写对齐 App |
| `docs/DESIGN.md` | 设计系统参考（视觉基准 = 实际 App） | ✅ |
| `docs/STRATEGY.md` | 调研支撑的路线图与决策 | ✅ |
| `CHANGELOG.md` | 版本日志 | ✅ |

## 给贡献者 —— 只跑引擎

```bash
make test                                       # 引擎测试（零依赖）
cd core && python3 demo.py                       # 端到端演示，不用网页
cd core && python3 derive.py "用 Rust 写高性能 HTTP 服务器"   # 命令行倒推（需要 key）
```

## 设计语言

纯黑白 + 暖灰纸感；衬线显赫（Fraunces）+ 无衬线正文（Inter）+ 等宽（JetBrains Mono）；手绘线性图标；年轻女老师看板娘，黑白墨线。完整规范（色彩 / 组件 / 游戏化视觉 / 动效）见 **[docs/DESIGN.md](docs/DESIGN.md)**。

## 借鉴的研究与项目

逆向设计（Understanding by Design）、知识空间理论与 ALEKS、最近发展区（ZPD）、贝叶斯知识追踪（BKT）、信心加权评分（CBM）、FSRS 间隔复习、刻意练习（Ericsson）、EPA/CEFR/ACS 胜任力框架、误解型干扰项设计——完整出处见 [docs/STRATEGY.md](docs/STRATEGY.md)。

## License

[Apache-2.0](./LICENSE)
