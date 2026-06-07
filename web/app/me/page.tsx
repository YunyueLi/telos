"use client";

// 我：资料 + 真实 XP/连胜/掌握分组 + 设置（倒推端点 / 重测起点 / 换目标）+ 跨设备备份。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { domainLabel } from "@/lib/telos/engine";
import { EndpointConfig } from "@/components/endpoint-config";
import { genId, loadActive, projectTitle, setActiveId, upsertProject, type Project } from "@/lib/telos/project";

function progressOf(p: Project): { mastered: number; total: number } {
  const total = p.points.length;
  const mastered = p.points.filter((k) => (p.state.mastery[k.id] ?? 0) >= 0.8).length;
  return { mastered, total };
}

const GROUPS = [
  { key: "done", titleKey: "group.done" },
  { key: "now", titleKey: "group.now" },
  { key: "learn", titleKey: "group.learn" },
  { key: "lock", titleKey: "group.lock" },
] as const;

export default function MePage() {
  const router = useRouter();
  const { t } = useT();
  const {
    ready,
    project,
    graph,
    view,
    xp,
    streak,
    projects,
    switchProject,
    removeProject,
    startNew,
  } = useProject();

  const [mounted, setMounted] = useState(false);
  const [backup, setBackup] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const doExport = () => {
    const p = loadActive();
    if (!p) {
      setMsg("还没有项目可备份");
      return;
    }
    setBackup(JSON.stringify(p));
    setMsg("已生成备份码 —— 复制保存，换设备粘贴导入即可");
  };
  const doImport = () => {
    try {
      const p = JSON.parse(backup) as Project;
      if (!p || !Array.isArray(p.points) || !p.points.length) throw new Error();
      const now = Date.now();
      const proj: Project = { ...p, id: p.id || genId(), createdAt: p.createdAt || now, updatedAt: now };
      upsertProject(proj);
      setActiveId(proj.id);
      setMsg(t("me.imported"));
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setMsg(t("me.invalidBackup"));
    }
  };
  const newLearning = () => {
    startNew();
    router.push("/");
  };
  const remove = (id: string, goal: string) => {
    if (window.confirm(t("me.confirmDelete", { goal }))) removeProject(id);
  };

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

        {/* 我的学习 —— 项目库（存放 / 沉淀 / 切换） */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("me.myLearning")} · {projects.length}</h3>
            <button className="appnew" style={{ marginLeft: "auto" }} onClick={newLearning}>
              <Icon name="plus" /> {t("shell.new")}
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="me-note">{t("me.noProjects")}</p>
          ) : (
            <div className="me-projects">
              {projects.map((p) => {
                const pr = progressOf(p);
                const active = project?.id === p.id;
                return (
                  <div key={p.id} className={`me-proj ${active ? "on" : ""}`}>
                    <button
                      className="me-proj-main"
                      title={p.goal}
                      onClick={() => {
                        switchProject(p.id);
                        router.push("/");
                      }}
                    >
                      <span className="me-proj-goal">{projectTitle(p)}</span>
                      <span className="me-proj-meta">
                        {active && <i className="me-proj-dot" />}
                        {t("me.projMastered", { m: pr.mastered, t: pr.total })}
                        {active ? ` · ${t("me.current")}` : ""}
                      </span>
                    </button>
                    <button
                      className="me-proj-del"
                      onClick={() => remove(p.id, p.goal)}
                      title={t("me.delProject")}
                      aria-label={t("me.delProject")}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="me-2col">
          {/* 掌握进度 */}
          <div>
            <div className="me-sect" style={{ marginTop: 0 }}>
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

          {/* 设置 + 备份 */}
          <div>
            <div className="me-sect" style={{ marginTop: 0 }}>
              <div className="me-sh">
                <h3>{t("me.settings")}</h3>
              </div>
              <div className="me-set">
                <button className="me-row" onClick={() => router.push("/diagnose")} disabled={!project}>
                  <Icon name="spark" className="ic" />
                  <span className="l">{t("me.resetStart")}</span>
                  <span className="v">{t("me.cbmDiag")}</span>
                </button>
                <button className="me-row" onClick={newLearning}>
                  <Icon name="plus" className="ic" />
                  <span className="l">{t("shell.new")}</span>
                  <span className="v">{t("me.keepProjects")}</span>
                </button>
              </div>

              {mounted && (
                <div style={{ marginTop: 14 }}>
                  <EndpointConfig />
                </div>
              )}
            </div>

            <div className="me-sect">
              <div className="me-sh">
                <h3>{t("me.backupTitle")}</h3>
              </div>
              <div className="me-note" style={{ marginTop: 0 }}>
                {t("me.backupNote")}
              </div>
              <div className="me-field">
                <button className="btn btn-line" style={{ padding: "9px 14px" }} onClick={doExport} disabled={!project}>
                  <Icon name="up" /> {t("me.export")}
                </button>
                <button className="btn btn-line" style={{ padding: "9px 14px" }} onClick={doImport} disabled={!backup.trim()}>
                  <Icon name="arrow" /> {t("me.import")}
                </button>
              </div>
              <textarea
                className="mono"
                value={backup}
                onChange={(e) => setBackup(e.target.value)}
                placeholder={t("me.backupPlaceholder")}
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 10,
                  border: "1px solid var(--line-soft)",
                  borderRadius: 12,
                  background: "var(--paper)",
                  padding: 12,
                  fontSize: 11,
                  color: "var(--ink-2)",
                  resize: "vertical",
                }}
              />
              <div className="me-dark dark" style={{ marginTop: 14 }}>
                <div className="l">{t("me.cloudTitle")}</div>
                <p>{t("me.cloudP")}</p>
                <a
                  className="btn btn-light"
                  href="https://github.com/YunyueLi/telos/blob/main/SUPABASE.md"
                  target="_blank"
                  rel="noreferrer"
                  style={{ justifyContent: "center", width: "100%" }}
                >
                  {t("me.cloudCta")} <Icon name="arrow" />
                </a>
              </div>

              {msg && <div className="me-msg">{msg}</div>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
