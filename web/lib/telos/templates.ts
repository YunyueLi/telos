// 官方图谱模板店（知识付费）：人工精修的能力图谱，一键导入成学习项目。
//
// 安全模型：付费模板的完整内容（desc/drill/benchmark）【不在前端 / 不进公开仓库】——否则会被白嫖。
//   · 前端这里只放 meta + 大纲预览（仅模块名 + 数量，公开安全）。
//   · 完整 points 存 Cloudflare KV（workers/templates-private.json 灌入），由 Worker /template
//     鉴权后下发（已购该模板 或 Pro）→ 前端 derive.ts 的 fetchTemplatePoints 拉取。
//   · 免费模板（科二）内容直接内嵌（本就公开，可离线 / 无端点导入）。
// 内容以中文撰写（目标人群）。
import type { KnowledgePoint } from "./engine";

export interface TemplateOutline {
  title: string; // 模块 / 阶段名
  n: number; // 该模块的能力点数
}

export interface TemplateMeta {
  id: string;
  sku: string; // checkout plan 传值（tpl_*，webhook 写 app_metadata.telos_templates）
  title: string;
  goal: string; // 导入后的项目 goal
  desc: string;
  price: string; // 展示价
  url: string; // checkout 链接（服务商建品后填；空 = 暂不可单独购买，Pro 可解锁）
  free?: boolean; // 免费模板
  tags: string[];
  nodes: number; // 能力点总数（预览）
  minutes: number; // 预计总时长（分钟，预览）
  outline: TemplateOutline[]; // 阶段大纲（公开安全：仅模块名 + 数量，不含可练内容）
}

export interface Template extends TemplateMeta {
  points?: KnowledgePoint[]; // 仅免费模板内嵌；付费模板 undefined → 购买 / Pro 后从 Worker 下发
}

const P = (
  id: string,
  name: string,
  prereqs: string[],
  module: string,
  moduleTitle: string,
  domain: KnowledgePoint["domain"],
  minutes: number,
  desc: string,
  drill: string,
  benchmark: string,
  isGoal?: boolean,
): KnowledgePoint => ({ id, name, prereqs, module, moduleTitle, domain, minutes, desc, drill, benchmark, isGoal });

// 从完整 points 派生预览 meta（免费模板用；付费模板手写 outline，因为前端没有它们的 points）。
function preview(points: KnowledgePoint[]): { nodes: number; minutes: number; outline: TemplateOutline[] } {
  const outline: TemplateOutline[] = [];
  let minutes = 0;
  for (const p of points) {
    minutes += p.minutes ?? 30;
    const last = outline[outline.length - 1];
    if (last && last.title === (p.moduleTitle || "")) last.n += 1;
    else outline.push({ title: p.moduleTitle || "", n: 1 });
  }
  return { nodes: points.length, minutes, outline };
}

// ── 免费模板 · 驾照科目二一把过（内容公开，前端内嵌可离线导入）──
const KE2: KnowledgePoint[] = [
  P("k1", "调整座椅后视镜并建立固定参考视角", [], "m1", "上车基本功", "D", 30,
    "每次上车 30 秒内完成座椅/靠背/两侧后视镜标准化调整，视角与教练车一致。",
    "每次练车先做「三调一系」流程并让教练抽查；拍下标准视角照片对照。",
    "新手：3 分钟调好；进阶：1 分钟；精英：30 秒且每次视角误差肉眼不可辨。"),
  P("k2", "离合半联动的精准控制（坡道不溜不熄）", ["k1"], "m1", "上车基本功", "D", 45,
    "能用脚感找到半联动点并稳住，车速可控制在匀速蠕行。",
    "平地蠕行练习：保持比走路慢的匀速 100 米不熄火；再加坡道定点起步 20 次。",
    "新手：10 次起步熄火 ≤2；进阶：坡道起步不溜车；精英：任意坡度 3 秒内平稳起步。"),
  P("k3", "方向盘打法与回正的肌肉记忆", ["k1"], "m1", "上车基本功", "D", 30,
    "不看方向盘能知道当前打了几圈，快打快回不交叉手。",
    "原地打盘练习：听口令「左一圈半/回正」盲打 50 组，错误立即纠正。",
    "新手：低头确认才不出错；进阶：盲打 9 成对；精英：边倒车边打盘零失误。"),
  P("r1", "倒车入库：看点、修方向与边距控制", ["k2", "k3"], "m2", "五项攻坚", "D", 60,
    "左右入库均能按点位操作，中途能根据后视镜边距做 5-10cm 级微调。",
    "分解练习：先只练「打死点」，再只练「回正点」，最后整套；每次记录压线原因。",
    "新手：10 次入库成功 6 次；进阶：9 次且不压线；精英：连续 20 次满分含中途修正。"),
  P("r2", "侧方停车一把入位并正确出库", ["r1"], "m2", "五项攻坚", "D", 45,
    "按点位一把入库不压线，出库打灯并正确借道。",
    "整套计时练习 15 次：重点盯「后轮过线再打死」时机，错一次复盘一次。",
    "新手：成功率 60%；进阶：90% 不压线；精英：连续 15 次满分且用时 <90 秒。"),
  P("r3", "曲线行驶与直角转弯的轨迹预判", ["k3"], "m2", "五项攻坚", "D", 40,
    "能用车头/雨刮参考点预判轨迹，全程不压线不停车。",
    "慢速过曲线 10 趟专注「点到就打」；直角转弯练「后视镜对杆再打死」20 次。",
    "新手：偶尔压线；进阶：连续 10 次零压线；精英：换不同教练车仍稳定。"),
  P("r4", "坡道定点停车与起步（30cm 边距）", ["k2"], "m2", "五项攻坚", "D", 40,
    "右边距稳定 30cm 内，定点停准（杠对肩/镜），起步不溜不熄。",
    "边距专项：直线贴 30cm 行驶 200 米 ×5；再定点 15 次记录偏差厘米数。",
    "新手：边距 50cm 内；进阶：30cm 内+定点不丢分；精英：连续 10 次满分。"),
  P("e1", "全流程串联与考场节奏管理", ["r1", "r2", "r3", "r4"], "m3", "考前实战", "E", 90,
    "按考试顺序连贯完成五项，项与项之间会调整状态，全程心率可控。",
    "每次练车最后 30 分钟做「全真串联」：不许教练提醒，错了也走完再复盘。",
    "新手：能完整走完；进阶：串联成功率 80%；精英：连续 5 次模拟满分。"),
  P("e2", "考场踩点与异常处置预案", ["e1"], "m3", "考前实战", "F", 40,
    "熟悉考场点位差异，提前演练熄火/压线边缘/电子播报延迟等异常的处置动作。",
    "考前一周约考场练 2 小时：记录与平时点位的差异清单；口述 5 种异常的标准动作。",
    "新手：有书面预案；进阶：考场模拟 2 次通过；精英：模拟含一次故意制造的异常仍通过。", true),
];

export const TEMPLATES: Template[] = [
  {
    id: "kaoyan-en",
    sku: "tpl_kaoyan_en",
    title: "考研英语一 70+",
    goal: "考研英语一拿到 70 分以上",
    desc: "词汇地基 → 长难句手术 → 阅读突破 → 写作升级 → 全真冲刺，每个能力点都配刻意练习法与量化达标线。",
    price: "¥19.9",
    url: "",
    tags: ["考研", "英语", "应试"],
    nodes: 12,
    minutes: 675,
    outline: [
      { title: "词汇地基", n: 2 },
      { title: "长难句手术", n: 2 },
      { title: "阅读突破", n: 3 },
      { title: "写作模板到原创", n: 2 },
      { title: "翻译与节奏", n: 2 },
      { title: "终局冲刺", n: 1 },
    ],
  },
  {
    id: "py-backend",
    sku: "tpl_py_backend",
    title: "Python 后端面试通关",
    goal: "通过 Python 后端工程师面试并拿到 offer",
    desc: "代码内功 → 语言深水区 → 工程实战 → 系统设计 → 模拟面冲刺，覆盖算法/八股/项目深挖三条防线。",
    price: "¥19.9",
    url: "",
    tags: ["求职", "编程", "面试"],
    nodes: 10,
    minutes: 530,
    outline: [
      { title: "代码内功", n: 2 },
      { title: "语言深水区", n: 2 },
      { title: "工程实战", n: 3 },
      { title: "系统设计", n: 2 },
      { title: "面试冲刺", n: 1 },
    ],
  },
  {
    id: "ke2",
    sku: "tpl_ke2",
    title: "驾照科目二一把过",
    goal: "驾照科目二考试一次通过",
    desc: "上车基本功 → 五项攻坚 → 考前实战，把「凭感觉」拆成可练可测的动作要点，附异常处置预案。",
    price: "¥9.9",
    url: "",
    free: true, // 首发引流：免费
    tags: ["驾考", "技能"],
    points: KE2,
    ...preview(KE2),
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
