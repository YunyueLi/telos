"use client";

// 完课证书公开验真页：/cert?no=TL-XXXX —— 任何人凭编号核验真伪 + 看证书信息（社交传播落地页）。
// 公开（无需登录），向 Worker GET /cert/verify 查询；找到则展示纸感证书卡 + 已验证徽章，否则提示未找到。
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { useT } from "@/lib/telos/i18n";
import { verifyCertificate, type CertRecord } from "@/lib/telos/derive";

function CertInner() {
  const { t, lang } = useT();
  const params = useSearchParams();
  const serial = (params.get("no") || "").trim();
  const [state, setState] = useState<"loading" | "ok" | "fail" | "empty">(serial ? "loading" : "empty");
  const [rec, setRec] = useState<CertRecord | null>(null);

  useEffect(() => {
    if (!serial) {
      setState("empty");
      return;
    }
    let alive = true;
    setState("loading");
    verifyCertificate(serial).then((r) => {
      if (!alive) return;
      setRec(r);
      setState(r.found ? "ok" : "fail");
    });
    return () => {
      alive = false;
    };
  }, [serial]);

  const dateText = rec?.dateISO
    ? new Intl.DateTimeFormat(lang).format(new Date(`${rec.dateISO}T00:00:00`))
    : "";

  return (
    <div className="cert-verify">
      <div className="cert-card">
        <span className="cert-mark" aria-hidden="true">
          <Icon name="compass" style={{ width: 40, height: 40 }} />
        </span>
        <div className="cert-brand">Telos</div>
        <div className="cert-eyebrow">{t("cert.verifyTitle")}</div>

        {state === "loading" && (
          <div className="cert-load">
            <span className="spinner" /> {t("cert.verifyLoading")}
          </div>
        )}

        {state === "empty" && <p className="cert-msg">{t("cert.verifyEnter")}</p>}

        {state === "fail" && (
          <div className="cert-result">
            <div className="cert-badge fail">{t("cert.verifyFail")}</div>
            {serial && <div className="cert-serial">{serial}</div>}
          </div>
        )}

        {state === "ok" && rec && (
          <div className="cert-result">
            <div className="cert-badge ok">
              <Icon name="medal" style={{ width: 15, height: 15 }} /> {t("cert.verifyOk")}
            </div>
            <div className="cert-name">{rec.name || t("cert.anon")}</div>
            <div className="cert-completed">{t("cert.completed", { n: rec.nodes ?? 0 })}</div>
            <div className="cert-goal">「{rec.goal}」</div>
            <div className="cert-foot">
              {dateText && <span>{dateText}</span>}
              <span>
                {t("cert.serial")} {rec.serial}
              </span>
            </div>
          </div>
        )}

        <Link href="/" className="cert-cta">
          {t("cert.verifyCta")} <Icon name="arrow" style={{ width: 14, height: 14 }} />
        </Link>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="cert-portrait" src={asset("/portraits/cheer.webp")} alt="" aria-hidden="true" />
    </div>
  );
}

export default function CertPage() {
  return (
    <Suspense fallback={null}>
      <CertInner />
    </Suspense>
  );
}
