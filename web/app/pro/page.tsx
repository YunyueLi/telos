"use client";

// Telos Pro：定价 / 升级 / 权益管理页。
// 购买流程：登录 → 跳服务商托管收银台（带 user_id+plan）→ 支付 → webhook 写 Supabase app_metadata
// → 回跳本页 ?success=1 → 轮询 refreshEntitlement 确认解锁。权益绑定账号，多设备登录即享。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/telos/auth";
import { useT } from "@/lib/telos/i18n";
import {
  BILLING_EVENT,
  entitlement,
  isPro,
  refreshEntitlement,
  type Entitlement,
} from "@/lib/telos/billing";
import { BILLING, billingConfigured, checkoutUrl, type Plan } from "@/lib/telos/billing-config";

const PLANS: { key: Plan; nameKey: string; perKey: string }[] = [
  { key: "monthly", nameKey: "pro.planMonthly", perKey: "pro.perMo" },
  { key: "yearly", nameKey: "pro.planYearly", perKey: "pro.perYr" },
  { key: "lifetime", nameKey: "pro.planLife", perKey: "pro.once" },
];

export default function ProPage() {
  const { t, lang } = useT();
  const router = useRouter();
  const { user, ready } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [pro, setPro] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<"" | "ok" | "no">("");
  const [confirming, setConfirming] = useState(false); // 支付回跳后的轮询确认
  const pollRef = useRef<number>(0);

  const sync = () => {
    setEnt(entitlement());
    setPro(isPro());
  };

  useEffect(() => {
    setMounted(true);
    sync();
    void refreshEntitlement().then(sync);
    window.addEventListener(BILLING_EVENT, sync);
    return () => window.removeEventListener(BILLING_EVENT, sync);
  }, []);

  // 支付成功回跳（?success=1）：轮询确认（webhook 写入通常几秒内到）
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("success")) return;
    if (isPro()) return;
    setConfirming(true);
    let tries = 0;
    const tick = async () => {
      tries += 1;
      const e = await refreshEntitlement();
      sync();
      if (e.pro || tries >= 20) {
        setConfirming(false);
        return;
      }
      pollRef.current = window.setTimeout(tick, 3000);
    };
    void tick();
    return () => window.clearTimeout(pollRef.current);
  }, []);

  const buy = (plan: Plan) => {
    if (!user) {
      router.push("/account");
      return;
    }
    const url = checkoutUrl(plan, user.id, user.email ?? undefined);
    if (url) window.open(url, "_blank", "noopener");
  };

  const restore = async () => {
    setRestoring(true);
    setRestoreMsg("");
    const e = await refreshEntitlement();
    sync();
    setRestoring(false);
    setRestoreMsg(e.pro ? "ok" : "no");
  };

  const untilText =
    ent?.pro && ent.until
      ? t("pro.statusUntil", { date: new Intl.DateTimeFormat(lang).format(new Date(ent.until)) })
      : t("pro.statusLife");

  const configured = billingConfigured();

  return (
    <AppShell active="settings">
      <div className="me pro">
        <div className="me-head">
          <span className="pro-mark" aria-hidden="true">
            <Icon name="spark" style={{ width: 30, height: 30 }} />
          </span>
          <div className="info">
            <div className="eyebrow">{t("pro.eyebrow")}</div>
            <h2>Telos Pro</h2>
            <p className="me-goal">{t("pro.lead")}</p>
          </div>
        </div>

        {/* 支付回跳确认 / 已是 Pro 横幅 */}
        {mounted && confirming && (
          <div className="pro-banner">
            <span className="spinner" /> {t("pro.confirming")}
          </div>
        )}
        {mounted && pro && (
          <div className="dark pro-banner-pro">
            <Icon name="check" style={{ width: 16, height: 16 }} />
            <b>{t("pro.statusPro")}</b>
            <span className="u">{untilText}</span>
            <span className="sp" />
            {BILLING.manageUrl && ent?.plan !== "lifetime" && (
              <a className="btn btn-light pro-mng" href={BILLING.manageUrl} target="_blank" rel="noopener noreferrer">
                {t("pro.manage")}
              </a>
            )}
          </div>
        )}

        {/* 定价 */}
        {mounted && !pro && (
          <div className="me-sect">
            {!configured && <p className="me-note pro-soon">{t("pro.unconfigured")}</p>}
            <div className="pro-plans">
              {PLANS.map((p) => {
                const cfg = BILLING.plans[p.key];
                const hot = p.key === "yearly";
                return (
                  <div key={p.key} className={`pro-plan ${hot ? "hot" : ""}`}>
                    {hot && <span className="pro-flag">{t("pro.recommended")} {cfg.save}</span>}
                    <div className="pro-plan-n">{t(p.nameKey)}</div>
                    <div className="pro-price">
                      <b>{cfg.price}</b>
                      <span>{t(p.perKey)}</span>
                    </div>
                    <button
                      className={`btn ${hot ? "btn-ink" : "btn-line"} pro-buy`}
                      disabled={!configured || !cfg.url}
                      onClick={() => buy(p.key)}
                    >
                      {user ? t("pro.choose") : t("pro.goLogin")}
                    </button>
                  </div>
                );
              })}
            </div>
            {!user && ready && (
              <p className="me-note pro-login-note">
                {t("pro.needLogin")}{" "}
                <Link href="/account" className="pro-login-link">
                  {t("pro.goLogin")} →
                </Link>
              </p>
            )}
          </div>
        )}

        {/* 权益 */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>Pro</h3>
          </div>
          <div className="pro-perks">
            {(
              [
                ["pro.perkProjects", "pro.perkProjectsD", { n: BILLING.freeProjectLimit }],
                ["pro.perkExport", "pro.perkExportD", undefined],
                ["pro.perkFuture", "pro.perkFutureD", undefined],
                ["pro.perkSupport", "pro.perkSupportD", undefined],
              ] as [string, string, Record<string, number> | undefined][]
            ).map(([k, d, vars]) => (
              <div key={k} className="pro-perk">
                <span className="pk-ic">
                  <Icon name="check" style={{ width: 14, height: 14 }} />
                </span>
                <span className="pk-t">
                  <b>{t(k, vars)}</b>
                  <span>{t(d, vars)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>{t("pro.faqT")}</h3>
          </div>
          <div className="pro-faq">
            {([1, 2, 3] as const).map((i) => (
              <div key={i} className="pro-qa">
                <b>{t(`pro.faq${i}q`)}</b>
                <p>{t(`pro.faq${i}a`)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 恢复购买 */}
        {mounted && user && (
          <div className="pro-restore">
            <button className="mh-relink" onClick={restore} disabled={restoring}>
              {restoring ? (
                <>
                  <span className="spinner" style={{ width: 12, height: 12 }} /> {t("pro.restoring")}
                </>
              ) : (
                <>
                  <Icon name="refresh" style={{ width: 13, height: 13 }} /> {t("pro.restore")}
                </>
              )}
            </button>
            {restoreMsg === "ok" && <span className="pro-restore-msg">{t("pro.confirmed")}</span>}
            {restoreMsg === "no" && <span className="pro-restore-msg">{t("pro.notYet")}</span>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
