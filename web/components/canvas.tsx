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
      <div className={styles.rfName}>
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

const nodeTypes = { telos: TelosNode };

export default function DeriveCanvas({
  graph,
  view,
  onOpenNode,
}: {
  graph: KnowledgeGraph;
  view: LearnerView;
  onOpenNode?: (id: string) => void;
}) {
  const { t } = useT();
  const [dir, setDir] = useState<Direction>(detectDir);
  const [pinned, setPinned] = useState(false); // 用户手动切过则不再自动跟随

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
    }));
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
    return { nodes: ns, edges: es, focus };
  }, [graph, view, dir, onOpenNode, t]);

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
          // 短图 fitView 铺满；长图把"活动区域"放到画面中央、用可读比例尺(看不全可拖)
          if (focus && graph.ids().length > 6) inst.setCenter(focus.x, focus.y, { zoom: 0.95, duration: 0 });
          else inst.fitView({ padding: 0.18, maxZoom: 1 });
        }}
      >
        <Background gap={24} size={1} color="#e2dfd7" />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <button className={styles.dirToggle} onClick={toggle} title={t("canvas.toggleTitle")}>
            {dir === "TB" ? t("canvas.toHorizontal") : t("canvas.toVertical")}
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
