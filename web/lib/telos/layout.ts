// 阶段块布局：把倒推图谱按「阶段(module)」分块——每块内部做局部分层(Sugiyama 思路、TB 向下)，
// 再把各块当作带尺寸的矩形在平面上二维打包，列数按目标长宽比(≈3:2)自适应选取。
// 这样整图不再是「全局最长路径」拉出的长条，而是一片紧凑、错落、像地图的「阶段岛屿群」。
// 完全确定性(同输入同输出，利于导出/快照)、零依赖。详见 layout 调研（簇内 layered + 簇间 rectpacking）。
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
  d: string; // SVG path（渲染层用 React Flow 自带连线，此字段保留兼容）
}
export type Direction = "LR" | "TB"; // LR=横向网格(宽屏) / TB=单列纵向(竖屏/手机)

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
// 块内（局部 TB 分层）间距：层间(向下) / 同层兄弟(横向)——偏紧，让每座「岛」更聚拢
const L_RANK_GAP = 44;
const L_CROSS_GAP = 24;
// 块间打包间距：留足空间给阶段虚线框(每侧 22 + 顶部标签 26)互不相撞
const BLOCK_GAP_X = 96;
const BLOCK_GAP_Y = 116;
const ASPECT_TARGET = 1.5; // 期望整图 宽/高 ≈ 3:2
const MAX_COLS = 3; // 列数上限：再多又会横向变长条

interface Block {
  ids: string[];
  pos: Record<string, { x: number; y: number }>; // 块内相对中心坐标
  w: number;
  h: number;
}

// 单个阶段的局部分层（只看阶段内部的前置依赖，向下 TB）。复用 Sugiyama：最长路径分层 + 一遍 barycenter 降交叉。
function layoutModule(g: KnowledgeGraph, ids: string[]): Block {
  const set = new Set(ids);
  const pre = (id: string) => g.prerequisites(id).filter((p) => set.has(p));
  const dep = (id: string) => g.dependents(id).filter((d) => set.has(d));

  // 块内稳定拓扑序（保留 ids 给定顺序）
  const indeg: Record<string, number> = {};
  for (const id of ids) indeg[id] = pre(id).length;
  const q = ids.filter((id) => indeg[id] === 0);
  const order: string[] = [];
  const seen = new Set<string>();
  while (q.length) {
    const x = q.shift()!;
    if (seen.has(x)) continue;
    seen.add(x);
    order.push(x);
    for (const d of dep(x)) if (--indeg[d] === 0) q.push(d);
  }
  for (const id of ids) if (!seen.has(id)) order.push(id); // 有环兜底

  // 最长路径分层（块内）
  const layer: Record<string, number> = {};
  for (const id of order) {
    const ps = pre(id);
    layer[id] = ps.length ? Math.max(...ps.map((p) => (layer[p] ?? 0) + 1)) : 0;
  }
  const maxLayer = Math.max(0, ...Object.values(layer));
  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of order) byLayer[layer[id]].push(id);

  // 一遍 barycenter：每层按前置在上一层的平均位置排序，降低块内连线交叉
  const rowIndex: Record<string, number> = {};
  const bary = (id: string) => {
    const ps = pre(id);
    if (!ps.length) return 0;
    return ps.reduce((s, p) => s + (rowIndex[p] ?? 0), 0) / ps.length;
  };
  byLayer.forEach((col, li) => {
    if (li > 0) col.sort((a, b) => bary(a) - bary(b));
    col.forEach((id, i) => (rowIndex[id] = i));
  });

  const rankPitch = NODE_H + L_RANK_GAP;
  const crossPitch = NODE_W + L_CROSS_GAP;
  const maxRows = Math.max(1, ...byLayer.map((c) => c.length));
  const w = maxRows * crossPitch - L_CROSS_GAP;
  const h = (maxLayer + 1) * rankPitch - L_RANK_GAP;

  const pos: Record<string, { x: number; y: number }> = {};
  byLayer.forEach((col, li) => {
    const colW = col.length * crossPitch - L_CROSS_GAP;
    const startX = (w - colW) / 2 + NODE_W / 2; // 该层在块内水平居中
    col.forEach((id, i) => {
      pos[id] = { x: startX + i * crossPitch, y: li * rankPitch + NODE_H / 2 };
    });
  });

  return { ids, pos, w, h };
}

export function layeredLayout(g: KnowledgeGraph, direction: Direction = "LR"): Layout {
  const ids = g.ids();

  // 1) 按阶段(module)分组，保留首次出现顺序（倒推已按阶段拓扑排好）；无 module 的零散点归入一个末尾块
  const modOrder: string[] = [];
  const modSeen = new Set<string>();
  const noMod: string[] = [];
  for (const id of ids) {
    const m = g.get(id).module || "";
    if (!m) {
      noMod.push(id);
      continue;
    }
    if (!modSeen.has(m)) {
      modSeen.add(m);
      modOrder.push(m);
    }
  }
  const groups: string[][] = modOrder.map((m) => ids.filter((id) => (g.get(id).module || "") === m));
  if (noMod.length) groups.push(noMod);
  if (!groups.length) groups.push(ids); // 完全无分组兜底

  // 2) 每个阶段局部布局成一个块
  const blocks: Block[] = groups.map((gids) => layoutModule(g, gids));
  const K = blocks.length;

  // 3) 选列数：TB=单列纵向；LR=枚举列数取整体长宽比最接近目标的那个（封顶 MAX_COLS）
  let cols: number;
  if (direction === "TB" || K <= 1) {
    cols = 1;
  } else {
    let best = 1;
    let bestCost = Infinity;
    const maxC = Math.min(MAX_COLS, K);
    for (let c = 1; c <= maxC; c++) {
      const rows = Math.ceil(K / c);
      const colW = new Array(c).fill(0);
      const rowH = new Array(rows).fill(0);
      blocks.forEach((b, idx) => {
        const r = Math.floor(idx / c);
        const cc = idx % c;
        colW[cc] = Math.max(colW[cc], b.w);
        rowH[r] = Math.max(rowH[r], b.h);
      });
      const W = colW.reduce((s, x) => s + x, 0) + (c - 1) * BLOCK_GAP_X;
      const H = rowH.reduce((s, x) => s + x, 0) + (rows - 1) * BLOCK_GAP_Y;
      const cost = Math.abs(W / H / ASPECT_TARGET - 1);
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = c;
      }
    }
    cols = best;
  }

  // 4) 行主序填格：算每列宽、每行高，块在所在列内水平居中、在行内顶对齐（标签行对齐成「书架」节奏）
  const rows = Math.ceil(K / cols);
  const colW = new Array(cols).fill(0);
  const rowH = new Array(rows).fill(0);
  blocks.forEach((b, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    colW[c] = Math.max(colW[c], b.w);
    rowH[r] = Math.max(rowH[r], b.h);
  });
  const colX: number[] = [];
  let ax = MARGIN;
  for (let c = 0; c < cols; c++) {
    colX[c] = ax;
    ax += colW[c] + BLOCK_GAP_X;
  }
  const rowY: number[] = [];
  let ay = MARGIN;
  for (let r = 0; r < rows; r++) {
    rowY[r] = ay;
    ay += rowH[r] + BLOCK_GAP_Y;
  }

  // 5) 块内相对坐标 + 块偏移 → 全局坐标
  const nodes: Record<string, LayoutNode> = {};
  blocks.forEach((b, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const ox = colX[c] + (colW[c] - b.w) / 2; // 列内水平居中
    const oy = rowY[r]; // 行内顶对齐
    for (const id of b.ids) {
      const p = b.pos[id];
      nodes[id] = { id, layer: idx, x: ox + p.x, y: oy + p.y };
    }
  });

  const width = MARGIN + (cols ? colX[cols - 1] + colW[cols - 1] : 0);
  const height = MARGIN + (rows ? rowY[rows - 1] + rowH[rows - 1] : 0);

  // 6) 连线：from/to 即前置依赖；d 用通用竖向贝塞尔（渲染走 React Flow 连线，d 仅保留兼容）
  const edges: LayoutEdge[] = [];
  for (const id of ids) {
    const to = nodes[id];
    for (const p of g.prerequisites(id)) {
      const from = nodes[p];
      if (!from || !to) continue;
      const my = (from.y + to.y) / 2;
      edges.push({ from: p, to: id, d: `M${from.x},${from.y} C${from.x},${my} ${to.x},${my} ${to.x},${to.y}` });
    }
  }

  return { width, height, nodeW: NODE_W, nodeH: NODE_H, direction, nodes, edges };
}
