"use client";

// 官方模板店：人工精修图谱一键导入（知识付费）。
// 获取规则：免费模板内容前端内嵌、直接导入；付费模板的完整内容【不在前端】——
// 已购（app_metadata.telos_templates，webhook 发货）或 Pro 时，由 Worker /template 鉴权后下发再导入。
// 可单独购买（checkout 链接接入后出现「购买」）。导入受免费版 3 项目上限约束（Pro 无限）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/telos/auth";
import { useT } from "@/lib/telos/i18n";
import { BASE } from "@/lib/base";
import { BILLING_EVENT, entitlement, isPro, refreshEntitlement } from "@/lib/telos/billing";
import { BILLING, checkoutUrlRaw } from "@/lib/telos/billing-config";
import { TEMPLATES, type Template } from "@/lib/telos/templates";
import { fetchTemplatePoints } from "@/lib/telos/derive";
import { genId, listProjects, setActiveId, upsertProject, type Project } from "@/lib/telos/project";
import { emptyState } from "@/lib/telos/engine";

export default function StorePage() {
  const { t } = useT();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [pro, setPro] = useState(false);
  const [owned, setOwned] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null); // 展开大纲的模板
  const [importing, setImporting] = useState<string | null>(null); // 正在下发内容的模板
  const [msg, setMsg] = useState<string>("");

  const sync = () => {
    setPro(isPro());
    setOwned(entitlement().templates);
  };
  useEffect(() => {
    setMounted(true);
    sync();
    void refreshEntitlement().then(sync);
    window.addEventListener(BILLING_EVENT, sync);
    return () => window.removeEventListener(BILLING_EVENT, sync);
  }, []);

  const canImport = (tp: Template) => tp.free || pro || owned.includes(tp.id);
  const limitReached = () => !isPro() && listProjects().length >= BILLING.freeProjectLimit;

  const doImport = async (tp: Template) => {
    if (importing) return;
    if (limitReached()) {
      setMsg(`${t("pro.limitT", { n: BILLING.freeProjectLimit })} — ${t("pro.limitD")}`);
      return;
    }
    setMsg("");
    // 免费模板内容前端内嵌；付费模板从 Worker 鉴权下发（内容不在前端）。
    let points = tp.points;
    if (!points) {
      setImporting(tp.id);
      try {
        points = await fetchTemplatePoints(tp.id);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
        setImporting(null);
        return;
      }
      setImporting(null);
    }
    const now = Date.now();
    const proj: Project = {
      id: genId(),
      goal: tp.goal,
      title: tp.title,
      points,
      state: emptyState(),
      createdAt: now,
      updatedAt: now,
    };
    upsertProject(proj);
    setActiveId(proj.id);
    try {
      window.sessionStorage.setItem("telos:open-map", "1"); // 跳过首页默认的「新学习」，直达新图谱地图
    } catch {
      /* ignore */
    }
    window.location.assign(`${BASE}/`); // 全量刷新让 Provider 重读项目库
  };

  const buy = (tp: Template) => {
    if (!user) {
      window.location.assign(`${BASE}/account/`);
      return;
    }
    const url = checkoutUrlRaw(tp.url, tp.sku, user.id, user.email ?? undefined);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <AppShell>
      <div className="me store">
        <div className="me-head">
          <span className="pro-mark" aria-hidden="true">
            <Icon name="map" style={{ width: 26, height: 26 }} />
          </span>
          <div className="info">
            <h2>{t("store.title")}</h2>
            <p className="me-goal">{t("store.lead")}</p>
          </div>
        </div>

        {msg && (
          <div className="ob-limit" role="note" style={{ maxWidth: "none", marginTop: 18 }}>
            <Icon name="spark" style={{ width: 16, height: 16 }} />
            <span className="lt">
              <span>
                {msg} <Link href="/pro">{t("pro.limitGo")} →</Link>
              </span>
            </span>
          </div>
        )}

        <div className="store-grid">
          {TEMPLATES.map((tp) => {
            const hours = Math.max(1, Math.round(tp.minutes / 60));
            const own = mounted && canImport(tp);
            const opened = open === tp.id;
            const busy = importing === tp.id;
            return (
              <div key={tp.id} className="store-card">
                <div className="store-card-top">
                  <b className="store-name">{tp.title}</b>
                  <span className={`store-price ${tp.free ? "free" : ""}`}>
                    {tp.free ? t("store.free") : own ? t("store.owned") : tp.price}
                  </span>
                </div>
                <p className="store-desc">{tp.desc}</p>
                <div className="store-meta">
                  <span>{t("store.nodes", { n: tp.nodes })}</span>
                  <span>{t("store.stages", { n: tp.outline.length })}</span>
                  <span>{t("store.hours", { n: hours })}</span>
                </div>
                <button className="store-preview" onClick={() => setOpen(opened ? null : tp.id)}>
                  {opened ? t("store.fold") : t("store.preview")}
                  <Icon name="chevron" className={opened ? "up" : ""} style={{ width: 13, height: 13 }} />
                </button>
                {opened && (
                  <div className="store-outline">
                    {tp.outline.map((m, i) => (
                      <div key={i} className="store-mod">
                        <span className="store-mod-i">{String(i + 1).padStart(2, "0")}</span>
                        <span className="store-mod-t">{m.title}</span>
                        <span className="store-mod-n">{t("store.nodes", { n: m.n })}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="store-actions">
                  {own ? (
                    <button className="btn btn-ink store-btn" onClick={() => doImport(tp)} disabled={busy}>
                      {busy ? <span className="spinner" /> : <Icon name="play" />}{" "}
                      {busy ? t("store.importing") : t("store.get")}
                    </button>
                  ) : tp.url ? (
                    <button className="btn btn-line store-btn" onClick={() => buy(tp)}>
                      {t("store.buy")} · {tp.price}
                    </button>
                  ) : (
                    <span className="store-soon">
                      {t("store.soon")} ·{" "}
                      <Link href="/pro" className="store-soon-link">
                        {t("store.proUnlock")}
                      </Link>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="me-note" style={{ marginTop: 22, textAlign: "center" }}>
          {t("store.moreSoon")}
        </p>
      </div>
    </AppShell>
  );
}
