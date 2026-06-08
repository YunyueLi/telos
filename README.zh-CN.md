<div align="center">

<img src="web/public/portraits/hero.png" width="116" alt="Telos" />

# Telos

**说出目标，倒着学会它。**

*说出你想达成的结果 —— Telos 倒推出一张按模块组织的能力地图，诊断你已会的，只教你缺的。*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-111.svg)](LICENSE)
&nbsp;[![Stars](https://img.shields.io/github/stars/YunyueLi/telos?style=flat&color=111&label=Stars)](https://github.com/YunyueLi/telos)
&nbsp;[![English](https://img.shields.io/badge/README-English-111.svg)](README.md)

### ▶ [**立即体验**](https://yunyueli.github.io/telos/app/) —— 免安装、免 API key

<sub>[落地页](https://yunyueli.github.io/telos/) · [自己跑起来](#自己跑起来一条命令) · [工作原理](#工作原理) · [部署自己的](#部署自己的)</sub>

</div>

---

上面的在线版直接在浏览器里跑完整闭环——输入任意目标，看 Telos 倒推出一张完整、分阶段的知识地图。无需安装，key 在服务端。

```
目标 ─▶ 倒推 ─▶ 按模块组织的前置依赖地图（30–80 个可练能力）
     ─▶ 诊断你已会的（几道好题） ─▶ 你的学习前沿
     ─▶ 只教缺的（交互式微课） ─▶ 边教边验证 ─▶ 间隔复习 ─▶ 循环
```

## 哪种方式适合你？

| | **在线版（托管）** | **本地跑** | **部署自己的** |
| --- | --- | --- | --- |
| **适合** | 只想学东西 | 试用 / 二次开发 | 自建公开实例 |
| **配置** | 无 | `git clone` + 1 个免费 key + `make` | fork + 一键 Worker |
| **要 key 吗** | 不要（在服务端） | 要（免费 DeepSeek） | 要（在你的 Worker 里） |
| **数据存哪** | 浏览器（+ 可选账号同步） | 你本机 | 用户浏览器 / 你的 Supabase |
| **去哪** | **[打开应用 ▶](https://yunyueli.github.io/telos/app/)** | [↓ 自己跑起来](#自己跑起来一条命令) | [↓ 部署自己的](#部署自己的) |

> 第一次来？**直接[打开在线版](https://yunyueli.github.io/telos/app/)** —— 说个目标，看它倒推出地图。零配置、免 key。README 余下部分是给「想本地跑 / 自己部署」的人看的。

## 自己跑起来（一条命令）

```bash
git clone https://github.com/YunyueLi/telos && cd telos
make          # 或： ./start.sh
```

就这样。`make` 会从模板生成 `core/.env`（并告诉你去哪拿**免费** key）、首次自动装前端依赖，然后同时起「倒推代理 + 网页」并打开浏览器。网页**零配置**自动连本地代理——不用设环境变量、不用开第二个终端。

> 要 key？**DeepSeek** 注册即用——无需信用卡、约 5M 免费 token。到 **[platform.deepseek.com](https://platform.deepseek.com)** 拿一个，粘进 `core/.env`，刷新即可。（也可以直接在应用的「倒推」页底部粘贴端点地址，连 `.env` 都不用碰。）

| 命令 | 作用 |
| --- | --- |
| `make` / `./start.sh` | 本地跑全部（代理 + 网页），自动开浏览器 |
| `make test` | 跑引擎测试（Python，零依赖） |
| `make build` | 生产构建网页（静态导出） |
| `make help` | 列出所有命令 |

## 现在能用的

- **倒推任意目标**成一张*按模块组织*的能力地图——先用「蓝图」一发定好阶段，再把每个模块并行展开、缝合成一张无环图（按目标广度自适应，通常 **6–9 个阶段、30–80 个可练能力**）。
- **是可练能力，不是知识清单。** 每个节点都是可观测的 *can-do* 能力，带刻意练习 **drill** 和可量化**达标线**（新手 / 进阶 / 精英）——依据刻意练习与 EPA/CEFR/Bloom 胜任力框架。
- **自适应起点诊断。** 误解型干扰项选择题 + 信心加权（CBM）折进贝叶斯知识追踪（BKT），在图上用信息增益选题——只问约 14 道好题、其余靠传播推断，取代粗糙的「会 / 不会」。
- **交互式微课。** 预测 → 直觉讲解 → 跟着做 → 自我解释 → 渐隐填空 → 无脚手架检验（掌握闸门）——还给真实可点的优质公开课（可选联网检索，链接绝不幻觉）。
- **间隔复习（FSRS-4.5）。** 学过的进入复习队列；到期卡片按评分重排。
- **六大领域类**（陈述 · 程序 · 创造 · 动作 · 对抗 · 习惯）驱动不同诊断与复习策略——所以它既能学数学、也能学一项运动、还能养成一个习惯。

## 工作原理

Telos 是一个**逆向设计**引擎：你说出结果，它倒推出前置依赖，找到**你**在这张地图上的位置（最近发展区 ZPD），从那里往前教——每一步验证掌握、安排间隔复习让它留得住。

它把整套范式拆成三份可独立使用、可互操作的数据标准：

| 标准 | 作用 |
| --- | --- |
| **Outcome Spec** | 把一句话目标结构化成可倒推的规格 |
| **Knowledge Graph** | 带前置依赖、按阶段分组的「可训练能力」图谱（DAG） |
| **Learner State** | 单写者、可版本化的掌握状态 |

## 配置与 API key

- **在线版：** 零配置——倒推走 Cloudflare Worker，key 在服务端。
- **本地：** 在 `core/.env` 放一个免费 DeepSeek key（见上），或在应用里粘贴 `/derive` 端点。**切勿提交 key**——`core/.env` 已被 git 忽略。
- **可选联网检索**（微课给真实可点链接、而非搜索页）：在 `core/.env` 设 `TELOS_SEARCH_PROVIDER=tavily` + key。不配也能用，自动降级。

完整说明（本地 key、Cloudflare Worker、检索 provider、防盗刷）见 **[DERIVE.md](DERIVE.md)**。

## 部署自己的

静态前端（**GitHub Pages**）+ 一个把 key 存在服务端的 **Cloudflare Worker**。唯一必需的是 Worker，其余都优雅降级。

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

完整步骤（命令行备选、密钥、防盗刷、检索 provider）见 **[DERIVE.md](DERIVE.md)** · 账号与同步见 **[SUPABASE.md](SUPABASE.md)**。

## 目录结构

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `core/` | 学习引擎（Python，零依赖）：KST · BKT+CBM 诊断 · FIRe 学分传播 · FSRS 复习 · 多段 LLM 倒推 | ✅ 测试通过 |
| `web/` | 产品（Next.js + React + Tailwind + TypeScript，静态导出） | 🚧 活跃开发 |
| `workers/` | Cloudflare Worker LLM 代理（`/derive` · `/lesson` · `/probe` · `/title`） | ✅ |
| `landing/` | 落地页（静态 HTML —— 设计基准） | ✅ |
| `docs/STRATEGY.md` | 调研支撑的路线图与决策 | ✅ |

## 给贡献者 —— 只跑引擎

```bash
make test                                       # 引擎测试（零依赖）
cd core && python3 demo.py                       # 端到端演示，不用网页
cd core && python3 derive.py "用 Rust 写高性能 HTTP 服务器"   # 命令行倒推（需要 key）
```

## 设计语言

纯黑白 + 暖灰纸感；衬线显赫（Fraunces）+ 无衬线正文（Inter）+ 等宽（JetBrains Mono）；手绘线性图标；年轻女老师看板娘，黑白墨线。

## 借鉴的研究与项目

逆向设计（Understanding by Design）、知识空间理论与 ALEKS、最近发展区（ZPD）、贝叶斯知识追踪（BKT）、信心加权评分（CBM）、FSRS 间隔复习、刻意练习（Ericsson）、EPA/CEFR/ACS 胜任力框架、误解型干扰项设计——完整出处见 [docs/STRATEGY.md](docs/STRATEGY.md)。

## License

[Apache-2.0](./LICENSE)
