"use client";

// 学习「路径」渲染器：把拓扑序竖排成一条有阶段章节的旅程 —— 连续脊线串起阶段里程碑与节点，
// 状态由脊线上的「标记盘」承载（不是整块黑卡），当前节点醒目。手机竖屏 + 桌面（居中限宽）共用。
// 编辑式黑白纸感（见 docs/DESIGN.md）；依据移动学习地图调研（多邻国 path 的旅程感）。
import { Fragment, useEffect, useRef } from "react";
import { Icon } from "@/components/icon";
import styles from "./app.module.css";
import { KnowledgeGraph, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { layeredLayout } from "@/lib/telos/layout";
import { useT } from "@/lib/telos/i18n";

export default function PathView({
  graph,
  view,
  onOpenNode,
}: {
  graph: KnowledgeGraph;
  view: LearnerView;
  onOpenNode: (id: string) => void;
}) {
  const { t } = useT();
  const layout = layeredLayout(graph, "TB");
  // 模块顺序（按 ids 首次出现——倒推已按阶段排好）：路径按「模块 → 模块内依赖层」排，分阶段成体系。
  const modOrder = new Map<string, number>();
  for (const id of graph.ids()) {
    const m = graph.get(id).module || "";
    if (m && !modOrder.has(m)) modOrder.set(m, modOrder.size);
  }
  const ordered = Object.values(layout.nodes)
    .sort((a, b) => {
      const ma = modOrder.get(graph.get(a.id).module || "") ?? 999;
      const mb = modOrder.get(graph.get(b.id).module || "") ?? 999;
      return ma - mb || a.y - b.y || a.x - b.x;
    })
    .map((n) => n.id);
  const firstNow = view.next?.id ?? ordered.find((id) => view.visual[id] === "now") ?? null;

  const currentRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, [firstNow]);

  return (
    <div className={styles.pathWrap}>
      {/* 顶部纤细进度条（sticky）：只表进度，不再复述「下一步 + 节点名」——节点名留给 trail 高亮节点与右栏 CTA，避免一屏内重复出现。 */}
      <div className={styles.pathHead}>
        <span className={styles.pathHeadCount}>
          <b>{view.mastered}</b>
          <i>/{view.total}</i> {t("word.mastered")}
        </span>
        <span className={styles.pathHeadTrack} aria-hidden="true">
          <i style={{ width: `${view.pct}%` }} />
        </span>
        <span className={styles.pathHeadPct}>{view.pct}%</span>
      </div>

      <div className={styles.pathTrail}>
        {(() => {
          let lastMod = " ";
          return ordered.map((id) => {
            const st = view.visual[id];
            const kp = graph.get(id);
            const mod = kp.module || "";
            const header = mod && mod !== lastMod ? kp.moduleTitle || mod : null;
            lastMod = mod;
            const isNow = id === firstNow;
            return (
              <Fragment key={id}>
                {header && (
                  <div className={styles.pathChapter}>
                    <span className={styles.pathMk}>
                      <span className={styles.pathChapterNum}>{String((modOrder.get(mod) ?? 0) + 1).padStart(2, "0")}</span>
                    </span>
                    <span className={styles.pathChapterMain}>
                      <span className={styles.pathChapterTitle}>{header}</span>
                      <span className={styles.pathChapterRule} />
                    </span>
                  </div>
                )}
                <button
                  ref={isNow ? currentRef : undefined}
                  className={`${styles.pathStep} ${styles[`pn_${st}`]} ${isNow ? styles.pathCur : ""}`}
                  onClick={() => onOpenNode(id)}
                  aria-current={isNow ? "step" : undefined}
                >
                  <span className={styles.pathMk}>
                    <span className={styles.pathDisc}>
                      {st === "done" ? (
                        <Icon name="check" style={{ width: 11, height: 11 }} />
                      ) : kp.isGoal ? (
                        <Icon name="target" style={{ width: 11, height: 11 }} />
                      ) : null}
                    </span>
                  </span>
                  <span className={styles.pathCard}>
                    {isNow && <span className={styles.pathEyebrow}>{t("legend.now")}</span>}
                    <span className={styles.pathName}>{kp.name}</span>
                    <span className={styles.pathMeta}>
                      {domainLabel(kp.domain, t)} · {view.sub[id]}
                      {isNow && (
                        <>
                          {" "}
                          <Icon name="play" style={{ width: 10, height: 10, verticalAlign: -1 }} />
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </Fragment>
            );
          });
        })()}
      </div>
    </div>
  );
}
