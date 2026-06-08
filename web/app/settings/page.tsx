"use client";

// 独立设置页（从欢迎页 / 「我」抽离）：单列、区隔清晰。
// 倒推端点 → 我的学习（项目管理 + 紧随其下的备份/同步）→ 界面语言。顶栏齿轮进入。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { EndpointConfig } from "@/components/endpoint-config";
import { useAuth } from "@/lib/telos/auth";
import { useProject } from "@/lib/telos/use-project";
import { LANGS, useT, type Lang } from "@/lib/telos/i18n";
import { genId, loadActive, projectTitle, setActiveId, upsertProject, type Project } from "@/lib/telos/project";

function progressOf(p: Project): { mastered: number; total: number } {
  const total = p.points.length;
  const mastered = p.points.filter((k) => (p.state.mastery[k.id] ?? 0) >= 0.8).length;
  return { mastered, total };
}

export default function SettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useT();
  const { ready, project, projects, switchProject, removeProject, startNew } = useProject();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [backup, setBackup] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const newLearning = () => {
    startNew();
    router.push("/");
  };
  const remove = (id: string, goal: string) => {
    if (window.confirm(t("me.confirmDelete", { goal }))) removeProject(id);
  };
  const doExport = () => {
    const p = loadActive();
    if (!p) {
      setMsg(t("set.noBackup"));
      return;
    }
    setBackup(JSON.stringify(p));
    setMsg(t("set.backupMade"));
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

  if (!ready) {
    return (
      <AppShell>
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="me set">
        <div className="me-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pcirc">
            <img src={asset("/portraits/think.png")} alt="" />
          </span>
          <div className="info">
            <div className="eyebrow">{t("set.eyebrow")}</div>
            <h2>{t("me.settings")}</h2>
            <p className="me-goal">{t("set.lead")}</p>
          </div>
        </div>

        {/* 1 · 倒推端点 */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("set.endpoint")}</h3>
          </div>
          <p className="me-note" style={{ marginTop: 0, marginBottom: 12 }}>
            {t("set.endpointHint")}
          </p>
          {mounted && <EndpointConfig />}
        </div>

        {/* 2 · 我的学习（项目管理） */}
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
            <div className="me-projects" style={{ marginTop: 12 }}>
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
                      <Icon name="trash" style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* 备份与同步 —— 紧随项目，属同一「数据」范畴 */}
          <div className="set-backup">
            <div className="me-subh">{t("me.backupTitle")}</div>
            <p className="me-note" style={{ marginTop: 0 }}>
              {t("me.backupNote")}
            </p>
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
              rows={3}
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
              <div className="l">{user ? t("auth.signedIn") : t("me.cloudTitle")}</div>
              <p>{user ? user.email : t("me.cloudP")}</p>
              <Link
                href="/account"
                className="btn btn-light"
                style={{ justifyContent: "center", width: "100%" }}
              >
                {user ? t("psw.manage") : t("auth.signIn")} <Icon name="arrow" />
              </Link>
            </div>
            {msg && <div className="me-msg">{msg}</div>}
          </div>
        </div>

        {/* 3 · 界面语言 */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("set.lang")}</h3>
          </div>
          <div className="set-langs">
            {LANGS.map((l) => (
              <button
                key={l.code}
                className={`set-lang ${lang === l.code ? "on" : ""}`}
                onClick={() => setLang(l.code as Lang)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
