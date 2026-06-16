"use client";

// 独立设置页 = 纯配置（与「我」分工：内容/身份归 /me，应用配置归这里）。
// 接入状态 → Telos Pro → 数据（本地备份） → 界面语言。顶栏齿轮进入。
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { EndpointConfig } from "@/components/endpoint-config";
import { useProject } from "@/lib/telos/use-project";
import { LANGS, useT, type Lang } from "@/lib/telos/i18n";
import { BILLING_EVENT, isPro } from "@/lib/telos/billing";
import { genId, loadActive, setActiveId, upsertProject, type Project } from "@/lib/telos/project";

export default function SettingsPage() {
  const { t, lang, setLang } = useT();
  const { ready, project } = useProject();
  const [mounted, setMounted] = useState(false);
  const [backup, setBackup] = useState("");
  const [msg, setMsg] = useState("");
  const [pro, setPro] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncPro = () => setPro(isPro());
    syncPro();
    window.addEventListener(BILLING_EVENT, syncPro);
    return () => window.removeEventListener(BILLING_EVENT, syncPro);
  }, []);

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
            <img src={asset("/portraits/think.webp")} alt="" />
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

        {/* 2 · Telos Pro */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>Telos Pro</h3>
          </div>
          <Link href="/pro" className="set-pro">
            <span className="sp-ic">
              <Icon name="spark" style={{ width: 19, height: 19 }} />
            </span>
            <span className="sp-t">
              <b>
                Telos Pro
                {mounted && pro && <i className="sp-on">{t("set.proOn")}</i>}
              </b>
              <span>{mounted && pro ? t("pro.statusPro") : t("set.proFree")}</span>
            </span>
            <Icon name="chevron" className="sp-go" style={{ width: 16, height: 16, transform: "rotate(-90deg)" }} />
          </Link>
        </div>

        {/* 3 · 数据（本地备份）——项目管理/重新测起点已归位到「我」（/me）：内容归我，配置归设置 */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("me.backupTitle")}</h3>
          </div>
          <div className="set-backup" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
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
            {msg && <div className="me-msg">{msg}</div>}
          </div>
        </div>

        {/* 4 · 界面语言 */}
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
