"use client";

// 我：学习资料 + 真实 XP/连胜/掌握分组进度。
// 项目管理 / 倒推端点 / 备份与云同步已移到独立「设置」页（顶栏齿轮 → /settings）。
import Link from "next/link";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/telos/auth";
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
  const { t, lang } = useT();
  const { ready, project, graph, view, xp, streak, syncing, lastSync, syncNow } = useProject();
  const { configured, user, signOut } = useAuth();

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
                <Icon name="flame" /> {t("me.streakDays", { n: streak })}
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
              <div className="auth-synccard" style={{ marginTop: 12 }}>
                <div className="auth-syncrow">
                  <Icon name="refresh" className="ic" />
                  <div className="l">
                    <b>{t("auth.syncOn")}</b>
                    <span>
                      {syncing
                        ? t("auth.syncing")
                        : lastSync
                          ? t("auth.lastSync", { t: new Date(lastSync).toLocaleTimeString(lang) })
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
