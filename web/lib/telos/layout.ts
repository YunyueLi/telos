// 分层自动布局：把任意前置依赖 DAG 算成可渲染的坐标 + 连线。
// 这是 Sugiyama 分层思路的轻量实现（零依赖）——倒推出的任意图谱都能立刻成图。
// 后续上 React Flow 时，可把布局换成 d3-dag/elkjs，渲染层照样消费这套坐标。
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
  d: string; // SVG path
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

const NODE_W = 190;
const NODE_H = 72;
const MARGIN = 36;
// 层间距(rank：LR=列间距 / TB=行间距) 与 层内铺开间距(cross)
const LR_RANK_GAP = 92;
const LR_CROSS_GAP = 28;
const TB_RANK_GAP = 60;
const TB_CROSS_GAP = 38;

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
  // 有环时兜底：把剩余节点补到末尾（理论上倒推图无环）
  for (const id of g.ids()) if (!out.includes(id)) out.push(id);
  return out;
}

export function layeredLayout(g: KnowledgeGraph, direction: Direction = "LR"): Layout {
  const order = topoOrder(g);

  // 1) 最长路径分层：layer(n) = 0 若无前置，否则 max(layer(前置)) + 1
  const layer: Record<string, number> = {};
  for (const id of order) {
    const pre = g.prerequisites(id);
    layer[id] = pre.length ? Math.max(...pre.map((p) => (layer[p] ?? 0) + 1)) : 0;
  }
  const maxLayer = Math.max(0, ...Object.values(layer));

  // 2) 分组到各层
  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of order) byLayer[layer[id]].push(id);

  // 3) 一遍 barycenter：每层内按"前置在上一层的平均行位"排序，降低连线交叉
  const rowIndex: Record<string, number> = {};
  byLayer.forEach((col, li) => {
    if (li > 0) {
      col.sort((a, b) => bary(a) - bary(b));
    }
    col.forEach((id, i) => (rowIndex[id] = i));
  });
  function bary(id: string): number {
    const pre = g.prerequisites(id);
    if (!pre.length) return 0;
    const rows = pre.map((p) => rowIndex[p] ?? 0);
    return rows.reduce((s, r) => s + r, 0) / rows.length;
  }

  // 4) 坐标：rank 轴 = 层推进方向（LR→X，TB→Y）；cross 轴 = 层内铺开方向
  const vertical = direction === "TB";
  const rankSize = vertical ? NODE_H : NODE_W;
  const crossSize = vertical ? NODE_W : NODE_H;
  const rankGap = vertical ? TB_RANK_GAP : LR_RANK_GAP;
  const crossGap = vertical ? TB_CROSS_GAP : LR_CROSS_GAP;
  const rankPitch = rankSize + rankGap;
  const crossPitch = crossSize + crossGap;
  const maxRows = Math.max(1, ...byLayer.map((c) => c.length));
  const rankSpan = (maxLayer + 1) * rankPitch - rankGap;
  const crossSpan = maxRows * crossPitch - crossGap;

  const nodes: Record<string, LayoutNode> = {};
  byLayer.forEach((col, li) => {
    const rankPos = MARGIN + li * rankPitch + rankSize / 2;
    const colCross = col.length * crossPitch - crossGap;
    const crossStart = MARGIN + (crossSpan - colCross) / 2 + crossSize / 2;
    col.forEach((id, i) => {
      const crossPos = crossStart + i * crossPitch;
      nodes[id] = {
        id,
        layer: li,
        x: vertical ? crossPos : rankPos,
        y: vertical ? rankPos : crossPos,
      };
    });
  });

  const width = MARGIN * 2 + (vertical ? crossSpan : rankSpan);
  const height = MARGIN * 2 + (vertical ? rankSpan : crossSpan);

  // 5) 连线：沿 rank 轴 前置 → 后继（TB 竖直控制点 / LR 水平控制点）
  const edges: LayoutEdge[] = [];
  for (const id of g.ids()) {
    const to = nodes[id];
    for (const pre of g.prerequisites(id)) {
      const from = nodes[pre];
      if (!from || !to) continue;
      let d: string;
      if (vertical) {
        const x1 = from.x, y1 = from.y + NODE_H / 2, x2 = to.x, y2 = to.y - NODE_H / 2;
        const dy = Math.max(20, (y2 - y1) * 0.5);
        d = `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
      } else {
        const x1 = from.x + NODE_W / 2, y1 = from.y, x2 = to.x - NODE_W / 2, y2 = to.y;
        const dx = Math.max(28, (x2 - x1) * 0.5);
        d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      }
      edges.push({ from: pre, to: id, d });
    }
  }

  return { width, height, nodeW: NODE_W, nodeH: NODE_H, direction, nodes, edges };
}
