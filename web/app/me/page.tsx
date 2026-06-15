"use client";

// 我 = 身份 + 内容 + 成就：账户(登录/云同步) → 我的学习项目(管理/切换/重新测) → 掌握进度。
// 应用配置（接入/Pro/本地备份/语言）在独立「设置」页（顶栏齿轮 → /settings）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { asset, BASE } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/telos/auth";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { domainLabel } from "@/lib/telos/engine";
import { projectTitle, type Project } from "@/lib/telos/project";
import { isPro } from "@/lib/telos/billing";
import { buildCertificate, certSerial } from "@/lib/telos/certificate";
import { registerCertificate } from "@/lib/telos/derive";
import { PortraitGallery } from "@/components/portrait-gallery";
import { earnGraphInk } from "@/lib/telos/ink";
import { ThemePicker } from "@/components/theme-picker";

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
  const { t, lang } = useT();
  const router = useRouter();
  const { ready, project, projects, graph, view, xp, streak, syncing, lastSync, syncError, syncNow, switchProject, removeProject, startNew } =
    useProject();
  const { configured, user, signOut } = useAuth();
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [openStage, setOpenStage] = useState<string | null>(null); // 掌握进度：展开的阶段（手风琴）
  const PROJECT_CAP = 6; // 默认最多 2 行（桌面 3 列）；多的折叠

  const newLearning = () => {
    startNew();
    router.push("/");
  };
  const remove = (id: string, goal: string) => {
    if (window.confirm(t("me.confirmDelete", { goal }))) removeProject(id);
  };
  // 完课证书（Pro）：项目全部能力点完成后领取——canvas 直绘下载 PNG
  const getCert = async (p: Project) => {
    if (!isPro()) {
      router.push("/pro");
      return;
    }
    const name = (window.prompt(t("cert.namePh")) || "").trim() || t("cert.anon");
    const goal = projectTitle(p);
    const serial = certSerial(goal, p.id); // 稳定编号：目标 + 项目 id（不随语言/领取时刻变，验真用同一个）
    const dateISO = new Date().toISOString().slice(0, 10);
    const verifyUrl = `${window.location.host}${BASE}/cert?no=${serial}`;
    await registerCertificate({ serial, name, goal, nodes: p.points.length, dateISO }); // 登记到 KV，供 /cert 公开验真
    earnGraphInk(serial); // 完成整张图谱发墨（幂等，按 serial 去重）
    const canvas = buildCertificate({
      name,
      goal,
      nodes: p.points.length,
      dateText: new Intl.DateTimeFormat(lang).format(new Date()),
      completedText: t("cert.completed", { n: p.points.length }),
      serialLabel: t("cert.serial"),
      brandText: t("ob.tagline"),
      serial,
      verifyUrl,
    });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `telos-cert-${p.id.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
            {/* 标签行已删：连胜/进度/XP 与下方四格统计完全重复 */}
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

        {/* 账户 · 跨设备同步（与「设置 → 接入状态」呼应；登录/退出/同步都在这里） */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("auth.eyebrow")}</h3>
          </div>
          {!configured ? (
            <Link href="/settings" className="me-note" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              {t("auth.notConfigured")} <Icon name="arrow" style={{ width: 12, height: 12 }} />
            </Link>
          ) : user ? (
            <>
              <div className="me-acct">
                <span className="dot dot-ok" />
                <div className="me-acct-id">
                  <b>{user.email}</b>
                  <span>{t("auth.signedIn")}</span>
                </div>
              </div>
              <div className={`auth-synccard ${syncError ? "has-err" : ""}`.trim()} style={{ marginTop: 12 }}>
                <div className="auth-syncrow">
                  <Icon name="refresh" className="ic" />
                  <div className="l">
                    <b>{syncError ? t("auth.syncPaused") : t("auth.syncOn")}</b>
                    <span>
                      {syncing
                        ? t("auth.syncing")
                        : syncError
                          ? t("auth.syncPausedSub")
                          : lastSync
                            ? `${t("auth.syncedN", { n: projects.length })} · ${t("auth.lastSync", { t: new Date(lastSync).toLocaleTimeString(lang) })}`
                            : t("auth.never")}
                    </span>
                  </div>
                  <button className="btn btn-line" onClick={() => void syncNow()} disabled={syncing}>
                    {syncing ? t("auth.syncing") : t("auth.syncNow")}
                  </button>
                </div>
              </div>
              <button className="auth-signout" onClick={() => void signOut()}>
                <Icon name="logout" /> {t("auth.signOut")}
              </button>
            </>
          ) : (
            <div className="me-dark dark">
              <div className="l">{t("conn.syncTitle")}</div>
              <p>{t("conn.syncSub")}</p>
              <Link href="/account" className="btn btn-light" style={{ justifyContent: "center", width: "100%" }}>
                {t("auth.signIn")} <Icon name="arrow" />
              </Link>
            </div>
          )}
        </div>

        {/* 我的学习项目（管理/切换/删除 + 重新测起点）——内容归「我」，从设置页归位 */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>
              {t("me.myLearning")} · {projects.length}
            </h3>
            <button className="appnew" style={{ marginLeft: "auto" }} onClick={newLearning}>
              <Icon name="plus" /> {t("shell.new")}
            </button>
          </div>
          <div className="me-set">
            <button className="me-row" onClick={() => router.push("/diagnose")} disabled={!project}>
              <Icon name="spark" className="ic" />
              <span className="l">{t("me.resetStart")}</span>
              <span className="v">{t("me.cbmDiag")}</span>
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="me-note">{t("me.noProjects")}</p>
          ) : (
            <>
              <div className="me-projects" style={{ marginTop: 12 }}>
                {(showAllProjects ? projects : projects.slice(0, PROJECT_CAP)).map((p) => {
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
                      {pr.total > 0 && pr.mastered === pr.total && (
                        <button
                          className="me-proj-cert"
                          onClick={() => getCert(p)}
                          title={isPro() ? t("cert.get") : t("cert.onlyDone")}
                          aria-label={t("cert.get")}
                        >
                          <Icon name="medal" style={{ width: 15, height: 15 }} />
                        </button>
                      )}
                      <button
                        className="me-proj-del"
                        onClick={() => remove(p.id, p.goal)}
                        title={t("me.delProject")}
                        aria-label={t("me.delProject")}
                      >
                        <Icon name="trash" style={{ width: 15, height: 15 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {projects.length > PROJECT_CAP && (
                <button className="me-more" onClick={() => setShowAllProjects((v) => !v)}>
                  {showAllProjects ? t("me.collapse") : t("me.showAll", { n: projects.length })}
                  <Icon name="chevron" className={showAllProjects ? "me-more-up" : ""} />
                </button>
              )}
            </>
          )}
        </div>

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
          {project && graph && view && view.modules.length > 0 && (
            <p className="me-note" style={{ margin: "-2px 0 12px", fontStyle: "italic" }}>{t("me.inkScale")}</p>
          )}
          {!project || !graph || !view ? (
            <p className="me-note">{t("me.noProjectYet")}</p>
          ) : (
            view.modules.length > 0 ? (
              // 阶段概览：与地图侧栏同一套数据（view.modules）。平时只看阶段行（序号·标题·进度条·已掌握/总），
              // 点开看该阶段能力点——节点量大时不再平铺堆积。
              <div className="mh-mods me-stages">
                {view.modules.map((m, i) => {
                  const mp = m.total ? Math.round((m.mastered / m.total) * 100) : 0;
                  const open = openStage === m.id;
                  const nodes = graph.ids().filter((id) => (graph.get(id).module || "") === m.id);
                  return (
                    <div key={m.id} className={`mh-mod-wrap ${open ? "open" : ""}`}>
                      <button
                        className="mh-mod"
                        onClick={() => setOpenStage(open ? null : m.id)}
                        aria-expanded={open}
                        title={m.title}
                      >
                        <span className="mh-mod-i">{String(i + 1).padStart(2, "0")}</span>
                        <span className="mh-mod-main">
                          <span className="mh-mod-t">{m.title || t("me.stageN", { n: i + 1 })}</span>
                          <span className="mh-mod-track">
                            <i style={{ width: `${mp}%` }} />
                          </span>
                        </span>
                        <span className="mh-mod-n">
                          {m.mastered}/{m.total}
                        </span>
                        <Icon name="chevron" className={`mh-mod-cv ${open ? "up" : ""}`} style={{ width: 14, height: 14 }} />
                      </button>
                      {open && (
                        <div className="me-chips me-stage-chips">
                          {nodes.map((id) => (
                            <span key={id} className={`me-chip ${view.visual[id]}`}>
                              {graph.get(id).name}
                              <s>{domainLabel(graph.get(id).domain, t)}</s>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
            )
          )}
        </div>

        {/* 看板娘形象集（陪伴形象 · 关系型激励）：选一个设为当前陪伴，注入首页 hero */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("pt.galleryTitle")}</h3>
          </div>
          <PortraitGallery projects={projects} />
        </div>

        {/* 纸张主题（cosmetic 装扮 · 免费 2 款 + Pro 全解锁） */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("theme.pickerTitle")}</h3>
          </div>
          <p className="me-note" style={{ marginBottom: 14 }}>{t("theme.sub")}</p>
          <ThemePicker />
        </div>
      </div>
    </AppShell>
  );
}
