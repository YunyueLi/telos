"use client";

// 画布 P1：React Flow 渲染倒推图谱 —— 滚轮缩放 / 拖拽平移 / fitView / 小地图。
// 节点位置复用纯函数 layeredLayout（后续 P3 可换 d3-dag/elk，渲染层不变）。
import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./derive.module.css";
import { KnowledgeGraph, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { layeredLayout } from "@/lib/telos/layout";

type NodeStatus = "done" | "now" | "learn" | "lock";

interface TelosData {
  name: string;
  sub: string;
  status: NodeStatus;
  isGoal: boolean;
  domainLabel: string;
  [key: string]: unknown;
}

function TelosNode({ data }: NodeProps) {
  const d = data as TelosData;
  return (
    <div className={`${styles.rfNode} ${styles[d.status]}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
      <span className={styles.rfBadge} title={`学习类型：${d.domainLabel}`}>
        {d.domainLabel}
      </span>
      <div className={styles.rfName}>
        {d.isGoal && <span className={styles.star}>★</span>}
        {d.name}
      </div>
      <s>{d.sub}</s>
      <Handle type="source" position={Position.Right} className={styles.handle} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { telos: TelosNode };

export default function DeriveCanvas({ graph, view }: { graph: KnowledgeGraph; view: LearnerView }) {
  const { nodes, edges } = useMemo(() => {
    const layout = layeredLayout(graph);
    const ns: Node[] = Object.values(layout.nodes).map((n) => ({
      id: n.id,
      type: "telos",
      position: { x: n.x - layout.nodeW / 2, y: n.y - layout.nodeH / 2 },
      data: {
        name: graph.get(n.id).name,
        sub: view.sub[n.id],
        status: view.visual[n.id],
        isGoal: !!graph.get(n.id).isGoal,
        domainLabel: domainLabel(graph.get(n.id).domain),
      } satisfies TelosData,
      style: { width: layout.nodeW, height: layout.nodeH },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
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
    return { nodes: ns, edges: es };
  }, [graph, view]);

  return (
    <div className={styles.rfWrap}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1} color="#e2dfd7" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => ((n.data as TelosData).status === "done" ? "#141310" : "#b9b4a8")}
          maskColor="rgba(240,238,233,0.6)"
        />
      </ReactFlow>
    </div>
  );
}
