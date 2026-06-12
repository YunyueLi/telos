"use client";

// 官方模板店：人工精修图谱一键导入（知识付费）。
// 获取规则：免费模板直接导入；付费模板 = 已购（app_metadata.telos_templates，webhook 发货）
// 或 Pro 每月免费领 1 个；可单独购买（checkout 链接接入后自动出现「购买」）。
// 导入受免费版 3 项目上限约束（Pro 无限）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/telos/auth";
import { useT } from "@/lib/telos/i18n";
import { BASE } from "@/lib/base";
import { BILLING_EVENT, entitlement, isPro, refreshEntitlement } from "@/lib/telos/billing";
import { BILLING, checkoutUrlRaw } from "@/lib/telos/billing-config";
import { TEMPLATES, claimedThisMonth, markClaimed, type Template } from "@/lib/telos/templates";
import { genId, listProjects, setActiveId, upsertProject, type Project } from "@/lib/telos/project";
import { emptyState } from "@/lib/telos/engine";

export default function StorePage() {
  const { t } = useT();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [pro, setPro] = useState(false);
  const [owned, setOwned] = useState<string[]>([]);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); // 展开大纲的模板
  const [msg, setMsg] = useState<string>("");

  const sync = () => {
    setPro(isPro());
    setOwned(entitlement().templates);
    setClaimed(claimedThisMonth());
  };
  useEffect(() => {
    setMounted(true);
    sync();
    void refreshEntitlement().then(sync);
    window.addEventListener(BILLING_EVENT, sync);
    return () => window.removeEventListener(BILLING_EVENT, sync);
  }, []);

  const canImport = (tp: Template) => tp.free || owned.includes(tp.id) || claimed === tp.id;
  const limitReached = () => !isPro() && listProjects().length >= BILLING.freeProjectLimit;

  const doImport = (tp: Template) => {
    if (limitReached()) {
      setMsg(`${t("pro.limitT", { n: BILLING.freeProjectLimit })} — ${t("pro.limitD")}`);
      return;
    }
    const now = Date.now();
    const proj: Project = {
      id: genId(),
      goal: tp.goal,
      title: tp.title,
      points: tp.points,
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

  const claim = (tp: Template) => {
    markClaimed(tp.id);
    setClaimed(tp.id);
    doImport(tp);
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
            <div className="eyebrow">{t("store.eyebrow")}</div>
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
            const mods: { title: string; n: number }[] = [];
            for (const p of tp.points) {
              const last = mods[mods.length - 1];
              if (last && last.title === (p.moduleTitle || "")) last.n += 1;
              else mods.push({ title: p.moduleTitle || "", n: 1 });
            }
            const hours = Math.round(tp.points.reduce((s, p) => s + (p.minutes ?? 30), 0) / 60);
            const own = mounted && canImport(tp);
            const opened = open === tp.id;
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
                  <span>{t("store.nodes", { n: tp.points.length })}</span>
                  <span>{t("store.stages", { n: mods.length })}</span>
                  <span>{t("store.hours", { n: hours })}</span>
                </div>
                <button className="store-preview" onClick={() => setOpen(opened ? null : tp.id)}>
                  {opened ? t("store.fold") : t("store.preview")}
                  <Icon name="chevron" className={opened ? "up" : ""} style={{ width: 13, height: 13 }} />
                </button>
                {opened && (
                  <div className="store-outline">
                    {mods.map((m, i) => (
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
                    <button className="btn btn-ink store-btn" onClick={() => doImport(tp)}>
                      <Icon name="play" /> {t("store.get")}
                    </button>
                  ) : (
                    <>
                      {mounted && pro && !claimed && (
                        <button className="btn btn-ink store-btn" onClick={() => claim(tp)}>
                          <Icon name="spark" /> {t("store.claim")}
                        </button>
                      )}
                      {tp.url ? (
                        <button className="btn btn-line store-btn" onClick={() => buy(tp)}>
                          {t("store.buy")} · {tp.price}
                        </button>
                      ) : (
                        !pro && (
                          <span className="store-soon">
                            {t("store.soon")} ·{" "}
                            <Link href="/pro" className="store-soon-link">
                              {t("store.claimHint")}
                            </Link>
                          </span>
                        )
                      )}
                      {mounted && pro && claimed && claimed !== tp.id && (
                        <span className="store-soon">{t("store.claimedNote")}</span>
                      )}
                    </>
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
