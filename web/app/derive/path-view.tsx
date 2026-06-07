"use client";

// 手机竖屏「蜿蜒路径」渲染器：把拓扑序竖排成一条引导路径，原生纵向滚动(不缩放)，
// 吸顶"下一步"、自动滚到当前节点。点卡片打开节点详情。依据移动地图调研(多邻国 path)。
import { useEffect, useRef } from "react";
import styles from "./derive.module.css";
import { KnowledgeGraph, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { layeredLayout } from "@/lib/telos/layout";

export default function PathView({
  graph,
  view,
  onOpenNode,
}: {
  graph: KnowledgeGraph;
  view: LearnerView;
  onOpenNode: (id: string) => void;
}) {
  const layout = layeredLayout(graph, "TB");
  const ordered = Object.values(layout.nodes)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((n) => n.id);
  const firstNow = view.next?.id ?? ordered.find((id) => view.visual[id] === "now") ?? null;

  const currentRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, [firstNow]);

  return (
    <div className={styles.pathWrap}>
      <div className={styles.pathSticky}>
        {view.next ? (
          <button onClick={() => onOpenNode(view.next!.id)}>
            下一步 · {view.next.name} →
          </button>
        ) : (
          <span className={styles.pathDone}>目标已达成 🎯</span>
        )}
        <span className={styles.pathCount}>
          {view.mastered}/{view.total}
        </span>
      </div>
      <div className={styles.pathList}>
        {ordered.map((id, i) => {
          const st = view.visual[id];
          const kp = graph.get(id);
          return (
            <button
              key={id}
              ref={id === firstNow ? currentRef : undefined}
              className={`${styles.pathNode} ${styles[`pn_${st}`]}`}
              onClick={() => onOpenNode(id)}
            >
              <span className={styles.pathDot} />
              <span className={styles.pathIndex}>{String(i + 1).padStart(2, "0")}</span>
              <span className={styles.pathCardName}>
                {kp.isGoal && <span className={styles.star}>★</span>}
                {kp.name}
              </span>
              <span className={styles.pathCardSub}>
                {domainLabel(kp.domain)} · {view.sub[id]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
