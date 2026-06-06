// The "Knowledge Graph" — eventually produced by telos-core from an Outcome Spec.
// For the demo this is the pre-derived FastAPI / JWT example, hand-laid on a 720×430 stage.

export type NodeStatus = "done" | "now" | "learn" | "lock";

export interface GraphNode {
  id: string;
  label: string;
  sub: string;
  status: NodeStatus;
  x: number;
  y: number;
}

export interface GraphPath {
  d: string;
  cls: string;
}

export interface DueItem {
  label: string;
  note: string;
}

export interface KnowledgeGraph {
  goal: string;
  derivedCount: number;
  masteredCount: number;
  totalCount: number;
  etaDays: number;
  nodes: GraphNode[];
  edges: GraphPath[];
  arrows: GraphPath[];
  next: { id: string; title: string; desc: string };
  due: DueItem[];
}

export const DEMO_GRAPH: KnowledgeGraph = {
  goal: "用 FastAPI 写带 JWT 鉴权的 REST API",
  derivedCount: 12,
  masteredCount: 5,
  totalCount: 12,
  etaDays: 9,
  nodes: [
    { id: "py", label: "Python 基础", sub: "已掌握", status: "done", x: 90, y: 66 },
    { id: "types", label: "函数与类型", sub: "已掌握", status: "done", x: 300, y: 66 },
    { id: "http", label: "HTTP 基础", sub: "已掌握", status: "done", x: 90, y: 214 },
    { id: "jwt", label: "JWT 原理", sub: "现在学这个", status: "now", x: 300, y: 214 },
    { id: "rest", label: "REST 设计", sub: "学习中 62%", status: "learn", x: 300, y: 352 },
    { id: "route", label: "FastAPI 路由", sub: "未解锁", status: "lock", x: 512, y: 124 },
    { id: "mw", label: "鉴权中间件", sub: "未解锁", status: "lock", x: 512, y: 292 },
    { id: "deploy", label: "部署上线", sub: "目标", status: "lock", x: 645, y: 209 },
  ],
  edges: [
    { d: "M90 66C170 68 230 66 300 66", cls: "edge" },
    { d: "M90 66C70 126 78 166 90 194", cls: "edge" },
    { d: "M90 214C160 216 230 214 300 214", cls: "edge strong" },
    { d: "M300 86C300 126 300 156 300 190", cls: "edge strong" },
    { d: "M90 234C120 294 200 342 296 352", cls: "edge" },
    { d: "M340 209C420 174 470 146 506 130", cls: "edge lock" },
    { d: "M340 220C420 254 470 280 506 292", cls: "edge lock" },
    { d: "M360 352C440 342 480 322 512 298", cls: "edge lock" },
    { d: "M560 130C600 156 624 180 642 200", cls: "edge lock" },
    { d: "M560 292C600 268 624 240 642 218", cls: "edge lock" },
  ],
  arrows: [
    { d: "M292 61l9 5-9 5", cls: "ah" },
    { d: "M85 186l5 9 6-8", cls: "ah" },
    { d: "M291 208l10 6-10 6", cls: "ah s" },
    { d: "M294 182l6 9 6-9", cls: "ah s" },
    { d: "M288 346l9 6-11 3", cls: "ah" },
    { d: "M499 126l8-1-3 8", cls: "ah" },
    { d: "M499 287l8 6-9 2", cls: "ah" },
    { d: "M506 302l7-5 0 8", cls: "ah" },
    { d: "M635 195l8 6-9 2", cls: "ah" },
    { d: "M636 223l7-6 1 8", cls: "ah" },
  ],
  next: {
    id: "jwt",
    title: "JWT 原理",
    desc: "前置已全部掌握，正处你的学习前沿。约 25 分钟。",
  },
  due: [
    { label: "HTTP 状态码", note: "该复习" },
    { label: "Python 字典", note: "该复习" },
  ],
};
