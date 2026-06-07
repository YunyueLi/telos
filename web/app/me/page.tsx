"use client";

// 我：学习资料 + 真实 XP/连胜/掌握分组进度。
// 项目管理 / 倒推端点 / 备份与云同步已移到独立「设置」页（顶栏齿轮 → /settings）。
import Link from "next/link";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { domainLabel } from "@/lib/telos/engine";

const GROUPS = [
  { key: "done", titleKey: "group.done" },
  { key: "now", titleKey: "group.now" },
  { key: "learn", titleKey: "group.learn" },
  { key: "lock", titleKey: "group.lock" },
] as const;

export default function MePage() {
  const { t } = useT();
  const { ready, project, graph, view, xp, streak } = useProject();

  if (!ready) {
    return (
      <AppShell active="me">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="me">
      <div className="me">
        <div className="me-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pcirc">
            <img src={asset("/portraits/reading.png")} alt="" />
          </span>
          <div className="info">
            <div className="eyebrow">{t("me.eyebrow")}</div>
            <h2>{t("me.title")}</h2>
            {project ? (
              <p className="me-goal">{t("me.goalLabel", { goal: project.goal })}</p>
            ) : (
              <p className="me-goal">{t("me.noGoal")}</p>
            )}
            <div className="me-tags">
              <span className="me-tag">
                <Icon name="spark" /> {t("me.streakDays", { n: streak })}
              </span>
              {view && (
                <span className="me-tag">
                  <Icon name="target" /> {t("me.progress", { m: view.mastered, t: view.total })}
                </span>
              )}
              <span className="me-tag">{xp} XP</span>
            </div>
          </div>
        </div>

        {view && (
          <div className="me-stats">
            <div className="me-stat">
              <span className="num">
                {view.mastered}
                <span style={{ fontSize: 16, color: "var(--ink-3)" }}>/{view.total}</span>
              </span>
              <span className="lab">{t("me.statMastered")}</span>
            </div>
            <div className="me-stat">
              <span className="num">{streak}</span>
              <span className="lab">{t("me.statStreak")}</span>
            </div>
            <div className="me-stat">
              <span className="num">{xp}</span>
              <span className="lab">XP</span>
            </div>
            <div className="me-stat">
              <span className="num">{view.pct}%</span>
              <span className="lab">{t("me.statCompletion")}</span>
            </div>
          </div>
        )}

        {/* 掌握进度 */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("me.masteryProgress")}</h3>
            {project && (
              <Link className="sectlabel right" href="/" style={{ display: "inline-flex", gap: 6 }}>
                {t("me.viewOnMap")} <Icon name="arrow" style={{ width: 12, height: 12 }} />
              </Link>
            )}
          </div>
          {!project || !graph || !view ? (
            <p className="me-note">{t("me.noProjectYet")}</p>
          ) : (
            GROUPS.map((grp) => {
              const items = graph.ids().filter((id) => view.visual[id] === grp.key);
              if (items.length === 0) return null;
              return (
                <div key={grp.key} className="me-grp">
                  <div className="me-glab">
                    <span className={`stt ${grp.key}`} />
                    {t(grp.titleKey)}
                    <span className="c">{items.length}</span>
                  </div>
                  <div className="me-chips">
                    {items.map((id) => (
                      <span key={id} className={`me-chip ${grp.key}`}>
                        {graph.get(id).name}
                        <s>{domainLabel(graph.get(id).domain, t)}</s>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
