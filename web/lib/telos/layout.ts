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
export interface Layout {
  width: number;
  height: number;
  nodeW: number;
  nodeH: number;
  nodes: Record<string, LayoutNode>;
  edges: LayoutEdge[];
}

const NODE_W = 152;
const NODE_H = 56;
const COL_GAP = 92; // 列间距（节点框之外）
const ROW_GAP = 28; // 行间距
const MARGIN = 36;

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

export function layeredLayout(g: KnowledgeGraph): Layout {
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

  // 4) 坐标
  const colPitch = NODE_W + COL_GAP;
  const rowPitch = NODE_H + ROW_GAP;
  const maxRows = Math.max(1, ...byLayer.map((c) => c.length));
  const height = MARGIN * 2 + maxRows * rowPitch - ROW_GAP;
  const width = MARGIN * 2 + (maxLayer + 1) * colPitch - COL_GAP;

  const nodes: Record<string, LayoutNode> = {};
  byLayer.forEach((col, li) => {
    const colH = col.length * rowPitch - ROW_GAP;
    const startY = (height - colH) / 2 + NODE_H / 2;
    col.forEach((id, i) => {
      nodes[id] = {
        id,
        layer: li,
        x: MARGIN + li * colPitch + NODE_W / 2,
        y: startY + i * rowPitch,
      };
    });
  });

  // 5) 连线：从前置右沿 → 后继左沿，水平控制点的三次贝塞尔
  const edges: LayoutEdge[] = [];
  for (const id of g.ids()) {
    const to = nodes[id];
    for (const pre of g.prerequisites(id)) {
      const from = nodes[pre];
      if (!from || !to) continue;
      const x1 = from.x + NODE_W / 2;
      const y1 = from.y;
      const x2 = to.x - NODE_W / 2;
      const y2 = to.y;
      const dx = Math.max(28, (x2 - x1) * 0.5);
      edges.push({ from: pre, to: id, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` });
    }
  }

  return { width, height, nodeW: NODE_W, nodeH: NODE_H, nodes, edges };
}
