# Telos · 设计参考（Design System）

> 单一权威设计参考。**设计基准 = 实际 App（`/app/`，即 `web/`）**；`landing/index.html` 已过时（待重写对齐 App）。
> 令牌实现在 `web/app/globals.css`，图标在 `web/components/sketch-defs.tsx` + `icon.tsx`，看板娘在 `web/public/portraits/`。

---

## 0. 一句话气质

纯黑白 + 暖灰纸感的**编辑设计（editorial）**风：衬线显赫、无衬线干净、手绘线性图标带轻微手抖，黑白二次元墨线看板娘。**零彩色**、**禁 emoji**。克制、有书卷气、像一本会动的笔记。

品牌词：**Telos**（希腊语「目的 / 终极目标」）。Slogan：**从结果倒推，学会任何事**。

---

## 1. 色彩 — 只有黑白与暖灰（零彩色）

| Token | 值 | 用途 |
|---|---|---|
| `--ink` | `#141310` | 主文字、主描边、实心强调、深色面板底 |
| `--ink-2` | `#56524A` | 正文次级、说明文字 |
| `--ink-3` | `#928E84` | 弱化标签、占位、mono 注脚 |
| `--line` | `#141310` | 强分隔线（同 ink） |
| `--line-soft` | `#E2DFD7` | 常规边框、弱分隔线 |
| `--hatch` | `#D5D1C7` | 斜纹填充（「学习中」状态） |
| `--card` | `#FFFFFF` | 卡片底 |
| `--paper` | `#F0EEE9` | 页面底（暖灰纸） |

规则：**不引入任何彩色**（连「正确=绿/错误=红」也不用——见 §4 用形状/填充表达状态）。深色强调用 `--ink` 反白（paper 字）。半透明叠加用 `rgba(20,19,16,.04~.06)`。

> **跨产品共享**：这套零彩色核心 + 字体是 Telos 与 Greenroom 的共享单源，权威值见 [`tokens.css`](tokens.css)。Greenroom 控制台（`app/greenroom.html`）已逐值对齐；其 `--ok/--warn/--live` 是面试场景的语义扩展，**Telos 不采用**（守零彩色）。改 token 先改 `tokens.css` 再同步两端。

---

## 2. 字体 — 衬线显赫 + 无衬线干净 + mono 做标签

- `--serif`: **Fraunces**（Georgia 兜底）— 标题、大数字、品牌词、引用斜体。`font-weight:500` 为主，强调 600，斜体用于点睛词。
- `--sans`: **Inter** — 正文、按钮、UI 文案。400/500/600。
- `--mono`: **JetBrains Mono** — 标签、eyebrow、计数、日期、技术注脚（常配 `text-transform:uppercase` + `letter-spacing`）。

字号尺度（App 实际）：Hero h1 ~62px / 页面 h2 30–42px / 卡片标题 19–21px / 正文 14.5–15.5px / 标签 mono 10–12px。负字距用于大衬线标题（`-.01em ~ -.02em`）。

---

## 3. 图标 — 线性 + 手抖滤镜（无填充）

- 实现：内联 SVG sprite（`sketch-defs.tsx` 的 `<symbol id="i-…">`）+ `<Icon name>`（`icon.tsx`）。统一 `fill:none;stroke:currentColor;stroke-width≈1.9;linecap/linejoin:round`。
- 手绘感：`filter:url(#sk)`（小图标，`feTurbulence`+`feDisplacementMap` 轻位移）/ `#skL`（大图、装饰线，位移更大）。
- 全量图标（`IconName`）：
  `check · lock · flag · target · arrow · up · clock · gauge · play · refresh · plus · spark · home · map · user · compass · settings · trash · globe · chevron · search · x · sort · mail · logout`
  **本程新增**：`flame`（连胜火焰）· `shield`（断签保护）· `calendar`（日历）· `medal`（等级/段位奖章）。
- 品牌字标：罗盘 `#i-compass` + 衬线「Telos」（`.word` / `.appbrand` / `.legal-brand`）。

---

## 4. 状态语言 — 用填充/描边/斜纹/虚线，而非颜色

知识点掌握态（地图节点 `.n`、我的页 chip、图例）：

| 态 | 视觉 | 含义 |
|---|---|---|
| `done` | 实心 ink + 反白字 | 已掌握 |
| `now` | 粗 ink 描边（1.8–2px） | 现在学（学习前沿） |
| `learn` | 45° hatch 斜纹 + ink-3 边 | 学习中（部分掌握） |
| `lock` | 虚线弱边 + ink-3 字 | 未解锁 |

打卡日历态（坚持 Tab `.cal-cell`）同语言：达标=实心、有学习=hatch、未来=虚线淡显、今日=外加墨环（box-shadow 双环）、冻结=白底 + 盾角标。

---

## 5. 组件规范

- **按钮 `.btn`**：药丸（`border-radius:999px`）+ 1.6px ink 边。`btn-ink`（实心黑/反白，主操作）· `btn-line`（透明描边，次操作）· `btn-light`（paper 底，用于深色面板上）。
- **卡片**：`--card` 底 + `--line-soft` 边 + `border-radius:14–18px`；强调卡用 `--ink` 边。
- **深色面板 `.dark`**：ink 底 + paper 字 + `border-radius:20px`，常叠 `.contour`（极淡等高线纹理 opacity .12）。用于引用、连胜横幅、推荐下一步等重点块。
- **药丸标签 `.chip` / pill**：mono 或 sans 小字 + 999px 边，可带图标。
- **看板娘肖像**：`.pcirc`（圆形，ink 1.6px 边，`object-position` 偏上取脸）· `.pmini`（圆角方形 48px）。**强制黑白**：`filter:grayscale(1) contrast(1.18)`（`.peep`）。
- **自定义下拉 `SelectMenu`**：portal 到 body 的 listbox（避开 backdrop-filter 包含块），替代原生 `<select>`；WAI-ARIA + 键盘可达。
- **进度环 `.ring`**：纯 SVG 双 circle（track + bar），`stroke-dashoffset` 过渡，达标显对勾否则显百分比。
- **段位天梯 `.tier-ladder`**：6 段，已达实心、当前带白点标记、未来 line-soft。
- **成就 `.ach`**：解锁=实心描边 + 对勾、未解锁=淡显 + 进度。
- **顶栏 `.appbar`**：sticky + backdrop-blur；桌面三段（品牌/导航/系统），移动端 grid 三段真居中（logo 左·切换器中·新建+头像右）。
- **底部 Tab `.apptabs`**（移动）：地图 · 复习 · 坚持 · 我。

---

## 6. 布局 / 栅格 / 圆角

- 容器：landing `max-width:1180`；App 内容页 `.me`/`.streak` `max-width:820–1000` 居中；登录/法律页 `max-width:420 / 740`。
- 圆角尺度：按钮 999px · 卡片 14–20px · 小元件 9–11px · 格子 6px。
- 响应式断点：**760px**（≥760 双栏，<760 单列）；移动顶栏 860px；部分 520/560 微调。
- 间距走 4 的倍数感（gap 6/8/12/16/18，section padding 28–34）。

---

## 7. 游戏化视觉语言（本程新增 · 坚持 Tab）

守红线：**XP 永远绑真实掌握/复习信号**，不绑在线时长；目标可调可「轻松档」、低压力、无愧疚式暗黑模式（防 over-justification）。

- **连胜横幅**：深色 `.dark` 块 + flame 图标 + 大 serif 数字 + 「天连胜」。
- **今日目标**：进度环 + 自定档位（轻松10/常规20/认真40/硬核60）+ 达标庆祝弹层（`goal-celebrate.tsx`，看板娘喝彩，~2.6s 自动消）。
- **打卡日历**：月历翻页（真实日期号、星期对应、Intl 本地化）。
- **断签保护**：盾牌 + 数量；缺勤自动桥接、连胜每 5 天奖 1（最多 2）。
- **等级/段位**：累计 XP→三角数等级曲线；段位见习→青铜→白银→黄金→铂金→钻石。
- **成就徽章**：8 枚，由真实信号派生。

---

## 8. 动效

- 手绘 wobble（`#sk`/`#skL` 位移滤镜，静态）。
- 进度/环：`stroke-dashoffset`/`width` 0.5–0.65s `cubic-bezier(.22,1,.36,1)`。
- 庆祝：fade + pop（`celebFade`/`celebPop`）。
- 倒推等待：分阶段进度 + 缓动 `92*(1-exp(-ms/22000))`。
- **`prefers-reduced-motion`**：关键动画降级为无。

---

## 9. 国际化

- 自研 9 语：`zh-CN / zh-TW / en / fr / ja / ko / es / ru / de`（`web/lib/telos/i18n-dict.ts`）。**加 key 必须补全 9 语**；重复 key 会让 `next build` 报错。
- 日期/星期/相对时间用 `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`（免手填多语）。

---

## 10. 信息架构

- App 路由：`/`(引导/地图) · `/diagnose` · `/review` · `/streak`(坚持) · `/me` · `/settings` · `/account`(登录) · `/privacy` · `/terms`。学习/诊断全屏接管。
- 单一真相源：`lib/telos/use-project.tsx`（localStorage + Supabase 同步）。

---

## 11. 资源位置

- 设计令牌：`web/app/globals.css`（`:root`）。
- 图标：`web/components/sketch-defs.tsx`（symbol）+ `icon.tsx`（`IconName`）。
- 看板娘（年轻女老师，黑白墨线，同角色多姿态）：`web/public/portraits/`
  `hero · welcome · point · think · teach · reading · present · cheer · notify · oops · avatar · empty`。
- 落地页镜像同一套 token/sprite（`landing/index.html`，待重写）。

---

## 12. 红线（每次遵守）

1. **纯黑白 + 暖灰纸感，零彩色**；状态用形状/填充表达。
2. **禁用 emoji**；图标一律手绘线性。
3. **看板娘**统一为年轻女老师、黑白二次元墨线、同一角色多姿态。
4. 衬线（Fraunces）显赫、无衬线（Inter）干净、mono（JetBrains）做标签。
5. 游戏化 **XP 绑真实学习信号**，不做虚荣指标 / 暗黑模式。
6. 设计基准以**实际 App** 为准；改设计先看 App 与本文件。
