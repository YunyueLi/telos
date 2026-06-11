// 学习地图导出渲染器：直接把节点/连线画到 <canvas>，不经 html-to-image。
//
// 为什么不用 html-to-image：它会同步克隆整个 React Flow DOM + 对每个元素 getComputedStyle 内联，
// 并抓取内联全部 web 字体——几十节点的大图上会阻塞主线程数十秒（41 节点实测 >45s 挂死）。
// 直接 canvas 2D 绘制是 O(节点数) 的纯计算，秒出；且 canvas 用页面已加载的 Inter/Fraunces，
// 导出更贴近真实视觉，无 React Flow 杂物。
"use client";

import type { Edge, Node } from "@xyflow/react";

interface NData {
  name: string;
  status: string; // done | now | learn | lock
  domainLabel: string;
  isGoal: boolean;
}

const C = {
  bg: "#faf9f6",
  paper: "#fffdf9",
  ink: "#141310",
  inkPaper: "#f4f1ea",
  border: "#bdb8ac",
  lockBorder: "#cfcabd",
  lockText: "#9a958a",
  edge: "#928e84",
  edgeLock: "#cfcabd",
  badge: "#8a857b",
};

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 按可用宽度折行（逐字符，兼顾 CJK 无空格）。
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const test = line + ch;
    if (line && ctx.measureText(test).width > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// 用当前 React Flow 的节点/连线数据，画出一张高清地图 canvas（与当前缩放/平移无关，导出整图）。
export function buildMapCanvas(nodes: Node[], edges: Edge[], title: string): HTMLCanvasElement {
  const box: Record<string, { cx: number; cy: number; w: number; h: number }> = {};
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const w = Number(n.style?.width) || 208;
    const h = Number(n.style?.height) || 88;
    const x = n.position.x;
    const y = n.position.y;
    box[n.id] = { cx: x + w / 2, cy: y + h / 2, w, h };
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!nodes.length) {
    minX = minY = 0;
    maxX = maxY = 200;
  }

  const PAD = 56;
  const titleH = title ? 54 : 12;
  const W = maxX - minX + PAD * 2;
  const H = maxY - minY + PAD * 2 + titleH;
  // 超采样求清晰：目标 3x，受「单边尺寸」+「总面积」双上限约束（防爆内存、兼容浏览器画布上限；触屏更保守）。
  // 旧版封顶 2x + 6000px 单边 → 宽地图(LR 长条 5000+px)实际只有 ~1x，放大就糊。这里把清晰度大幅提上来。
  const coarse = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
  const MAX_DIM = coarse ? 8000 : 14000; // 单边上限（桌面 <16384 画布限制）
  const MAX_AREA = coarse ? 14_000_000 : 42_000_000; // 总像素上限（控内存 / iOS 画布面积兼容）
  const S = Math.max(1, Math.min(3, MAX_DIM / Math.max(W, H), Math.sqrt(MAX_AREA / (W * H))));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * S);
  canvas.height = Math.round(H * S);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(S, S);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const ox = PAD - minX;
  const oy = PAD + titleH - minY;

  if (title) {
    ctx.fillStyle = C.ink;
    ctx.font = '600 22px Fraunces, Georgia, "Songti SC", serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, PAD, PAD + 24);
  }

  // 阶段/模块区域（最底层）：浅虚线框 + 左上序号标签
  for (const n of nodes) {
    if (n.type !== "stage") continue;
    const w = Number(n.style?.width) || 0;
    const h = Number(n.style?.height) || 0;
    const x = n.position.x + ox;
    const y = n.position.y + oy;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    roundRectPath(ctx, x, y, w, h, 18);
    ctx.fillStyle = "rgba(20,19,16,0.02)";
    ctx.fill();
    ctx.strokeStyle = C.lockBorder;
    ctx.stroke();
    ctx.setLineDash([]);
    const label = (n.data as { label?: string })?.label || "";
    if (label) {
      ctx.font = '600 12px ui-monospace, "SF Mono", monospace';
      const tw = ctx.measureText(label).width;
      const lx = x + 14;
      const ly = y + 6;
      ctx.fillStyle = C.bg; // 底色盖住虚线，像页面里的标签
      ctx.fillRect(lx - 5, ly - 1, tw + 12, 18);
      ctx.fillStyle = C.badge;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, lx, ly);
    }
  }

  // 连线（节点中心到中心；锁定态虚线浅色）
  ctx.lineWidth = 1.4;
  for (const e of edges) {
    const a = box[e.source];
    const b = box[e.target];
    if (!a || !b) continue;
    const locked = typeof e.style?.stroke === "string" && e.style.stroke === C.edgeLock;
    ctx.strokeStyle = locked ? C.edgeLock : C.edge;
    ctx.setLineDash(locked ? [4, 6] : []);
    ctx.beginPath();
    ctx.moveTo(a.cx + ox, a.cy + oy);
    ctx.lineTo(b.cx + ox, b.cy + oy);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 节点卡片
  for (const n of nodes) {
    if (n.type === "stage") continue;
    const c = box[n.id];
    const d = n.data as unknown as NData;
    const st = d.status;
    const done = st === "done";
    const lock = st === "lock";
    const x = c.cx - c.w / 2 + ox;
    const y = c.cy - c.h / 2 + oy;

    roundRectPath(ctx, x, y, c.w, c.h, 11);
    ctx.fillStyle = done ? C.ink : C.paper;
    ctx.fill();
    ctx.lineWidth = st === "now" ? 2 : 1.4;
    ctx.strokeStyle = done || st === "now" ? C.ink : lock ? C.lockBorder : C.border;
    ctx.setLineDash(lock ? [4, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    // 名称（居中、最多 4 行，与画布内一致）
    ctx.fillStyle = done ? C.inkPaper : lock ? C.lockText : C.ink;
    ctx.font = '600 12px Inter, system-ui, "PingFang SC", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const name = (d.isGoal ? "★ " : "") + d.name;
    const lines = wrapLines(ctx, name, c.w - 22).slice(0, 4);
    const lh = 15;
    let ty = c.cy + oy - (lines.length * lh) / 2 + lh / 2;
    for (const ln of lines) {
      ctx.fillText(ln, c.cx + ox, ty);
      ty += lh;
    }

    // 域类型角标（右上）
    if (d.domainLabel) {
      ctx.font = '600 8.5px ui-monospace, "SF Mono", monospace';
      ctx.fillStyle = done ? C.inkPaper : C.badge;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(d.domainLabel, x + c.w - 9, y + 13);
    }
  }

  return canvas;
}
