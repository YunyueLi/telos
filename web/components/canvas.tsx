"use client";

// 画布 P1+：React Flow 渲染倒推图谱 —— 缩放/平移/fitView/小地图，
// 并支持横向(LR，宽屏) / 纵向(TB，竖屏/手机) 两种方向，窄屏自动切纵向。
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Icon } from "@/components/icon";
import styles from "./app.module.css";
import { KnowledgeGraph, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { layeredLayout, type Direction } from "@/lib/telos/layout";
import { useT } from "@/lib/telos/i18n";

type NodeStatus = "done" | "now" | "learn" | "lock";

interface TelosData {
  name: string;
  sub: string;
  status: NodeStatus;
  isGoal: boolean;
  domainLabel: string;
  typeTitle: string;
  dir: Direction;
  onOpen: () => void;
  [key: string]: unknown;
}

function detectDir(): Direction {
  if (typeof window === "undefined") return "LR";
  return window.matchMedia("(max-width: 820px)").matches ? "TB" : "LR";
}

function TelosNode({ data }: NodeProps) {
  const d = data as TelosData;
  const vertical = d.dir === "TB";
  return (
    <div
      className={`${styles.rfNode} ${styles[d.status]}`}
      onClick={d.onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") d.onOpen();
      }}
    >
      <Handle
        type="target"
        position={vertical ? Position.Top : Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <span className={styles.rfBadge} title={d.typeTitle}>
        {d.domainLabel}
      </span>
      <div className={styles.rfName} title={d.name}>
        {d.isGoal && (
          <span className={styles.star}>
            <Icon name="target" style={{ width: 12, height: 12 }} />
          </span>
        )}
        {d.name}
      </div>
      <s>{d.sub}</s>
      <Handle
        type="source"
        position={vertical ? Position.Bottom : Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
}

// 阶段/模块区域：画在节点簇背后的浅色虚线框 + 左上「01 模块名」标签，把"阶段"标在图上。
// 标签可点击 → 缩放定位到该阶段（区域本身 pointer-events:none 不挡平移，标签 auto 接管点击）；当前阶段高亮。
function StageNode({ data }: NodeProps) {
  const d = data as { label: string; current?: boolean; bbox?: { x: number; y: number; width: number; height: number } };
  const rf = useReactFlow(); // 当前 live 实例（context），避免手存 ref 在 dev 双挂载下指向陈旧实例
  return (
    <div className={`${styles.rfStage} ${d.current ? styles.rfStageCur : ""}`}>
      <button
        className={styles.rfStageLabel}
        onClick={(e) => {
          e.stopPropagation();
          // 即时缩放定位到该阶段（duration:0 —— 动画版在本配置下会被取消，与 onInit 同样用瞬时）
          if (d.bbox) rf.fitBounds(d.bbox, { padding: 0.16, duration: 0 });
        }}
        title={d.label}
      >
        {d.label}
      </button>
    </div>
  );
}

const nodeTypes = { telos: TelosNode, stage: StageNode };

function downloadHref(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DeriveCanvas({
  graph,
  view,
  onOpenNode,
  title,
}: {
  graph: KnowledgeGraph;
  view: LearnerView;
  onOpenNode?: (id: string) => void;
  title?: string;
}) {
  const { t } = useT();
  const [dir, setDir] = useState<Direction>(detectDir);
  const [pinned, setPinned] = useState(false); // 用户手动切过则不再自动跟随
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (pinned) return;
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => setDir(mq.matches ? "TB" : "LR");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pinned]);

  const toggle = useCallback(() => {
    setPinned(true);
    setDir((d) => (d === "TB" ? "LR" : "TB"));
  }, []);

  const { nodes, edges, focus } = useMemo(() => {
    const layout = layeredLayout(graph, dir);
    const vertical = dir === "TB";
    const ns: Node[] = Object.values(layout.nodes).map((n) => ({
      id: n.id,
      type: "telos",
      position: { x: n.x - layout.nodeW / 2, y: n.y - layout.nodeH / 2 },
      data: {
        name: graph.get(n.id).name,
        sub: view.sub[n.id],
        status: view.visual[n.id],
        isGoal: !!graph.get(n.id).isGoal,
        domainLabel: domainLabel(graph.get(n.id).domain, t),
        typeTitle: t("canvas.typeTitle", { domain: domainLabel(graph.get(n.id).domain, t) }),
        dir,
        onOpen: () => onOpenNode?.(n.id),
      } satisfies TelosData,
      style: { width: layout.nodeW, height: layout.nodeH },
      sourcePosition: vertical ? Position.Bottom : Position.Right,
      targetPosition: vertical ? Position.Top : Position.Left,
      connectable: false,
      zIndex: 1, // 真实节点压在阶段区域之上
    }));

    // 阶段区域：按模块聚合节点的包围盒，画在簇背后并标「序号 + 模块名」（与手机路径页的阶段头一致）。
    const modOrder = new Map<string, number>();
    for (const id of graph.ids()) {
      const m = graph.get(id).module || "";
      if (m && !modOrder.has(m)) modOrder.set(m, modOrder.size);
    }
    const mb: Record<string, { x0: number; y0: number; x1: number; y1: number; title: string }> = {};
    for (const n of Object.values(layout.nodes)) {
      const m = graph.get(n.id).module || "";
      if (!m) continue;
      const x0 = n.x - layout.nodeW / 2;
      const y0 = n.y - layout.nodeH / 2;
      const x1 = n.x + layout.nodeW / 2;
      const y1 = n.y + layout.nodeH / 2;
      const b = mb[m] || { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, title: graph.get(n.id).moduleTitle || m };
      b.x0 = Math.min(b.x0, x0);
      b.y0 = Math.min(b.y0, y0);
      b.x1 = Math.max(b.x1, x1);
      b.y1 = Math.max(b.y1, y1);
      mb[m] = b;
    }
    const PADB = 22;
    const LABEL = 26; // 顶部给标签留空
    // 当前阶段 = 含「现在学/下一步」节点的模块，标签高亮，作为视觉锚点
    const nowId = view.next?.id ?? Object.keys(view.visual).find((id) => view.visual[id] === "now");
    const nowMod = nowId ? graph.get(nowId).module || "" : "";
    const stageNodes: Node[] = Object.entries(mb).map(([m, b]) => {
      const x = b.x0 - PADB;
      const y = b.y0 - PADB - LABEL;
      const w = b.x1 - b.x0 + PADB * 2;
      const h = b.y1 - b.y0 + PADB * 2 + LABEL;
      return {
        id: `__stage__${m}`,
        type: "stage",
        position: { x, y },
        data: {
          label: `${String((modOrder.get(m) ?? 0) + 1).padStart(2, "0")}  ${b.title}`,
          current: m === nowMod,
          bbox: { x, y, width: w, height: h }, // 点击阶段标签 → fitBounds 缩放定位到该阶段
        },
        style: { width: w, height: h, pointerEvents: "none" },
        zIndex: 0, // 沉在真实节点(zIndex 1)背后
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
      };
    });
    const es: Edge[] = layout.edges.map((e) => {
      const locked = view.visual[e.to] === "lock";
      const strong = e.to === view.next?.id || e.from === view.next?.id;
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: "default",
        style: {
          stroke: locked ? "#cfcabd" : strong ? "#141310" : "#928e84",
          strokeWidth: strong ? 2.2 : 1.6,
          strokeDasharray: locked ? "4 6" : undefined,
        },
      };
    });
    // 居中锚点：把"你所在的活动区域"(已掌握 + 现在学，非未解锁)的几何中心放到画面中央，
    // 读得清、又是当前该学的地方；未解锁的深层节点自然向外延伸(可拖动查看)。
    const active = Object.values(layout.nodes).filter((n) => view.visual[n.id] !== "lock");
    const pts = active.length ? active : Object.values(layout.nodes);
    const focus = {
      x: pts.reduce((s, n) => s + n.x, 0) / pts.length,
      y: pts.reduce((s, n) => s + n.y, 0) / pts.length,
    };
    return { nodes: [...stageNodes, ...ns], edges: es, focus };
  }, [graph, view, dir, onOpenNode, t]);

  const safeName = useMemo(() => {
    const base = (title || t("export.fallbackName")).replace(/[\\/:*?"<>|\n\r]+/g, " ").trim().slice(0, 50);
    return base || "telos-map";
  }, [title, t]);

  // 导出整张图为图片/PDF：用 map-export 直接 canvas 2D 绘制（不经 html-to-image，秒出、不挂死）。
  const exportImage = useCallback(
    async (kind: "png" | "pdf") => {
      if (!nodes.length) return;
      setExporting(true);
      try {
        const { buildMapCanvas } = await import("@/lib/telos/map-export");
        const canvas = buildMapCanvas(nodes, edges, title || "");
        const dataUrl = canvas.toDataURL("image/png");
        if (kind === "png") {
          downloadHref(dataUrl, `${safeName}.png`);
        } else {
          const { jsPDF } = await import("jspdf");
          const w = canvas.width;
          const h = canvas.height;
          const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "px", format: [w, h], compress: true });
          pdf.addImage(dataUrl, "PNG", 0, 0, w, h, undefined, "FAST");
          pdf.save(`${safeName}.pdf`);
        }
      } catch {
        /* 导出失败（极少见）→ 静默，用户可重试 */
      } finally {
        setExporting(false);
        setMenuOpen(false);
      }
    },
    [nodes, edges, title, safeName],
  );

  // 导出为思维导图（Markdown 大纲，按阶段分组）：任何思维导图/笔记工具都能直接吃。
  const exportMarkdown = useCallback(() => {
    const ids = graph.ids();
    const modCount = new Set(ids.map((id) => graph.get(id).module || "")).size;
    const lines: string[] = [`# ${title || t("export.fallbackName")}`, "", `> ${t("export.summary", { nodes: ids.length, modules: modCount })}`];
    let lastMod = " ";
    let modN = 0;
    for (const id of ids) {
      const kp = graph.get(id);
      const mod = kp.module || "";
      if (mod !== lastMod) {
        modN += 1;
        lastMod = mod;
        lines.push("", `## ${String(modN).padStart(2, "0")} ${kp.moduleTitle || mod || t("export.fallbackName")}`);
      }
      const done = view.visual[id] === "done";
      lines.push(`- [${done ? "x" : " "}] ${kp.isGoal ? "★ " : ""}${kp.name} — ${domainLabel(kp.domain, t)}`);
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }));
    downloadHref(url, `${safeName}.md`);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setMenuOpen(false);
  }, [graph, view, title, safeName, t]);

  return (
    <div className={styles.rfWrap}>
      <ReactFlow
        key={`${dir}|${graph.ids().join(",")}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        // Mac 触控板 / 无边记习惯：双指拖动=平移，捏合=缩放；空白处拖拽也平移
        panOnScroll
        zoomOnPinch
        panOnDrag
        zoomOnScroll={false}
        onInit={(inst) => {
          // 短图 fitView 铺满；长图把"活动区域"放到画面中央、用更大的可读比例尺(看不全可拖)
          if (focus && graph.ids().length > 6) inst.setCenter(focus.x, focus.y, { zoom: 1.2, duration: 0 });
          else inst.fitView({ padding: 0.16, maxZoom: 1.25 });
        }}
      >
        <Background gap={24} size={1} color="#e2dfd7" />
        <Controls showInteractive={false} />
        {/* 浮动工具栏「右段」：导出 + 方向 合成一枚等高纸感胶囊（中段是 page.tsx 的 路径/地图 切换） */}
        <Panel position="top-right" style={{ margin: 10 }}>
          <div className={styles.mapTools}>
            <div className={styles.exportWrap}>
              <button
                className={styles.mapToolBtn}
                onClick={() => setMenuOpen((o) => !o)}
                disabled={exporting}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={t("export.btn")}
              >
                <Icon name="up" style={{ width: 13, height: 13 }} />
                <span className={styles.mapToolLbl}>{exporting ? t("export.exporting") : t("export.btn")}</span>
                <Icon
                  name="chevron"
                  style={{ width: 11, height: 11 }}
                  className={menuOpen ? styles.mapToolCvUp : styles.mapToolCv}
                />
              </button>
              {menuOpen && (
                <>
                  <div className={styles.exportBackdrop} onClick={() => setMenuOpen(false)} />
                  <div className={styles.exportMenu} role="menu">
                    <button role="menuitem" onClick={() => exportImage("png")}>
                      {t("export.png")}
                    </button>
                    <button role="menuitem" onClick={() => exportImage("pdf")}>
                      {t("export.pdf")}
                    </button>
                    <button role="menuitem" onClick={exportMarkdown}>
                      {t("export.mindmap")}
                    </button>
                  </div>
                </>
              )}
            </div>
            <span className={styles.mapToolDiv} />
            <button className={`${styles.mapToolBtn} ${styles.mapToolDir}`} onClick={toggle} title={t("canvas.toggleTitle")}>
              {dir === "TB" ? t("canvas.toHorizontal") : t("canvas.toVertical")}
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
