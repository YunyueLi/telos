// XMind 式分层布局：把倒推 DAG 排成「思维导图可读」的结构 ——
// · rank 轴（LR=横向列 / TB=纵向行）仍用全局最长路径分层：依赖永远向阅读方向推进；
// · cross 轴不再用散点 barycenter，而是【阶段内主干树 tidy 排版】（参考 XMind/Reingold-Tilford）：
//   每个节点选一个「主干父」=同一阶段(module)内最深的前置 → 阶段内形成树；
//   子树排成连续紧凑块、父节点对准子块中心，兄弟距小、分支距大、阶段距更大 → 成块成组、扫读不跳；
// · 跨阶段的前置一律不参与排版，降级为「引用线」（细浅曲线），主干用圆角折线 —— 线条分级，杜绝满屏斜线。
// 同一算法换轴即横/纵两用。完全确定性（同输入同输出），零依赖。
import { KnowledgeGraph } from "./engine";

export interface LayoutNode {
  id: string;
  x: number; // 中心点
  y: number;
  layer: number;
}
export interface LayoutEdge {
  from: string;
  to: string;
  main: boolean; // true=阶段内主干（树边，圆角折线）；false=引用线（跨阶段或额外前置，细浅曲线）
  d: string; // 兼容字段（渲染走 React Flow / 导出走 map-export，自行画线）
}
export type Direction = "LR" | "TB"; // 左→右（横屏）/ 上→下（竖屏）

export interface Layout {
  width: number;
  height: number;
  nodeW: number;
  nodeH: number;
  direction: Direction;
  nodes: Record<string, LayoutNode>;
  edges: LayoutEdge[];
}

const NODE_W = 208;
const NODE_H = 88;
const MARGIN = 44;
// rank 轴：层间距（LR=列间距 / TB=行间距），给圆角折线留拐弯空间
const LR_RANK_GAP = 108;
const TB_RANK_GAP = 70;
// cross 轴两级间距：兄弟（同父子节点）< 分支（同带内不同子树）。阶段带之间靠 rank 轴分节，无需 cross 间距。
const SIB_GAP = { LR: 18, TB: 26 };
const GROUP_GAP = { LR: 46, TB: 60 };

function topoOrder(g: KnowledgeGraph): string[] {
  const indeg: Record<string, number> = {};
  for (const id of g.ids()) indeg[id] = g.prerequisites(id).length;
  const q = g.ids().filter((id) => indeg[id] === 0);
  const out: string[] = [];
  while (q.length) {
    const x = q.shift()!;
    out.push(x);
    for (const d of g.dependents(x)) if (--indeg[d] === 0) q.push(d);
  }
  for (const id of g.ids()) if (!out.includes(id)) out.push(id); // 有环兜底
  return out;
}

export function layeredLayout(g: KnowledgeGraph, direction: Direction = "LR"): Layout {
  const ids = g.ids();
  const order = topoOrder(g);
  const idx = new Map(ids.map((id, i) => [id, i]));

  // 1) 阶段级分层（XMind 分支组 × 科技树）：把每个阶段(module)当一个「带」，
  //    带与带按阶段级依赖做最长路径分层 —— 互不依赖的阶段【并排】（cross 轴堆叠），
  //    有依赖的阶段沿 rank 轴推进；带内列 = 仅看同阶段前置的最长路径。
  //    依赖恒向阅读方向（阶段级与带内都是），又不会把可并行的阶段拉成一条过长的河。
  const modOrder: string[] = [];
  const modSeen = new Set<string>();
  for (const id of ids) {
    const m = g.get(id).module || "";
    if (!modSeen.has(m)) {
      modSeen.add(m);
      modOrder.push(m);
    }
  }
  const inLayer: Record<string, number> = {}; // 带内列（仅同阶段前置参与）
  for (const id of order) {
    const mod = g.get(id).module || "";
    const pre = g.prerequisites(id).filter((p) => (g.get(p).module || "") === mod);
    inLayer[id] = pre.length ? Math.max(...pre.map((p) => (inLayer[p] ?? 0) + 1)) : 0;
  }
  const bandDepth = new Map<string, number>(); // 每带列数
  for (const id of ids) {
    const m = g.get(id).module || "";
    bandDepth.set(m, Math.max(bandDepth.get(m) ?? 0, inLayer[id] + 1));
  }
  // 阶段级 DAG → 阶段层（最长路径）。modOrder 即拓扑序（倒推按阶段递进产出；防御性跳过逆序边）。
  const stageLayer = new Map<string, number>();
  for (const m of modOrder) stageLayer.set(m, 0);
  for (const id of ids) {
    const mod = g.get(id).module || "";
    for (const p of g.prerequisites(id)) {
      const pm = g.get(p).module || "";
      if (pm === mod) continue;
      if (modOrder.indexOf(pm) > modOrder.indexOf(mod)) continue; // 逆序跨阶段边：只画引用线，不参与分层
      stageLayer.set(mod, Math.max(stageLayer.get(mod) ?? 0, (stageLayer.get(pm) ?? 0) + 1));
    }
  }
  // 阶段层 → 起始列：该层列宽 = 层内最深的带；阶段层交界加额外 rank 间距（给两侧阶段虚线框留缝）
  const vertical = direction === "TB";
  const rankSize = vertical ? NODE_H : NODE_W;
  const rankGap = vertical ? TB_RANK_GAP : LR_RANK_GAP;
  const rankPitch = rankSize + rankGap;
  const bandRankPad = (vertical ? 92 : 72) / rankPitch; // 换算成「列」的小数
  const maxStageLayer = Math.max(0, ...stageLayer.values());
  const stageColStart: number[] = [];
  {
    let acc = 0;
    for (let s = 0; s <= maxStageLayer; s++) {
      stageColStart[s] = acc;
      let deep = 1;
      for (const m of modOrder) if (stageLayer.get(m) === s) deep = Math.max(deep, bandDepth.get(m) ?? 1);
      acc += deep + bandRankPad;
    }
  }
  const layer: Record<string, number> = {};
  for (const id of ids) {
    const mod = g.get(id).module || "";
    layer[id] = stageColStart[stageLayer.get(mod) ?? 0] + inLayer[id];
  }
  const maxLayer = Math.max(0, ...Object.values(layer));

  // 2) 主干父：同阶段内最深的前置（并列取列表序靠前者）。没有 → 该节点是「分支组入口」(根)。
  //    跨阶段前置一律不当主干 → 每个阶段是独立的分支组，阶段框干净、不互相嵌套。
  const mainParent: Record<string, string | null> = {};
  for (const id of ids) {
    const mod = g.get(id).module || "";
    let best: string | null = null;
    for (const p of g.prerequisites(id)) {
      if ((g.get(p).module || "") !== mod) continue;
      if (best === null || layer[p] > layer[best]) best = p;
    }
    mainParent[id] = best;
  }
  const children: Record<string, string[]> = {};
  for (const id of ids) children[id] = [];
  for (const id of ids) {
    const p = mainParent[id];
    if (p) children[p].push(id);
  }
  for (const id of ids) children[id].sort((a, b) => (idx.get(a) ?? 0) - (idx.get(b) ?? 0));
  const roots = ids.filter((id) => !mainParent[id]); // ids 顺序天然按阶段分组（倒推按阶段产出）

  // 3) tidy 排版（cross 轴）：每个阶段带【独立】排——后序遍历，叶子按游标依次排、父取首末子中点
  //    （子树占连续区段且互不相交 → 带内不重叠）。
  const CS = vertical ? NODE_W : NODE_H; // cross 轴上的节点尺寸
  const sib = vertical ? SIB_GAP.TB : SIB_GAP.LR;
  const grp = vertical ? GROUP_GAP.TB : GROUP_GAP.LR;
  const cross: Record<string, number> = {};
  let cursor = 0;
  const place = (id: string): void => {
    const kids = children[id];
    if (!kids.length) {
      cross[id] = cursor + CS / 2;
      cursor += CS + sib;
      return;
    }
    for (const k of kids) place(k);
    cross[id] = (cross[kids[0]] + cross[kids[kids.length - 1]]) / 2;
  };
  const bandSpan = new Map<string, number>();
  for (const m of modOrder) {
    cursor = 0;
    let first = true;
    for (const r of roots) {
      if ((g.get(r).module || "") !== m) continue;
      if (!first) cursor += grp - sib; // 同带内分支组间距
      place(r);
      first = false;
    }
    bandSpan.set(m, Math.max(CS, cursor - sib));
  }
  // 同一阶段层的带在 cross 轴堆叠（带间 BAND_GAP 留阶段虚线框：22×2 内边距 + 26 标签），
  // 各阶段层再相对最高层居中 —— 紧凑、无对角空洞、阅读方向恒定。
  const BAND_GAP = vertical ? 100 : 88;
  const colSpan: number[] = [];
  for (let s = 0; s <= maxStageLayer; s++) {
    let h = 0;
    let n = 0;
    for (const m of modOrder) {
      if (stageLayer.get(m) !== s) continue;
      h += bandSpan.get(m) ?? CS;
      n += 1;
    }
    colSpan[s] = h + Math.max(0, n - 1) * BAND_GAP;
  }
  const crossSpan = Math.max(CS, ...colSpan);
  const bandOffset = new Map<string, number>();
  for (let s = 0; s <= maxStageLayer; s++) {
    let acc = (crossSpan - colSpan[s]) / 2;
    for (const m of modOrder) {
      if (stageLayer.get(m) !== s) continue;
      bandOffset.set(m, acc);
      acc += (bandSpan.get(m) ?? CS) + BAND_GAP;
    }
  }
  for (const id of ids) cross[id] += bandOffset.get(g.get(id).module || "") ?? 0;

  // 4) 坐标：rank 轴 = 层推进方向（LR→X / TB→Y），cross 轴 = 排列方向（rank 度量已在前文定义）
  const nodes: Record<string, LayoutNode> = {};
  for (const id of ids) {
    const rankPos = MARGIN + layer[id] * rankPitch + rankSize / 2;
    const crossPos = MARGIN + cross[id];
    nodes[id] = {
      id,
      layer: layer[id],
      x: vertical ? crossPos : rankPos,
      y: vertical ? rankPos : crossPos,
    };
  }
  const rankSpan = (maxLayer + 1) * rankPitch - rankGap;
  const width = MARGIN * 2 + (vertical ? crossSpan : rankSpan);
  const height = MARGIN * 2 + (vertical ? rankSpan : crossSpan);

  // 5) 连线：主干（树边）vs 引用线（跨阶段 / 同阶段额外前置）
  const edges: LayoutEdge[] = [];
  for (const id of ids) {
    for (const p of g.prerequisites(id)) {
      if (!nodes[p] || !nodes[id]) continue;
      edges.push({ from: p, to: id, main: mainParent[id] === p, d: "" });
    }
  }

  return { width, height, nodeW: NODE_W, nodeH: NODE_H, direction, nodes, edges };
}
