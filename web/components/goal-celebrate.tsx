"use client";

// 今日目标达成时的一次性庆祝：看板娘喝彩 + 连胜数，约 2.6s 自动消隐（点击可立即关）。
// 低调克制、不打断学习；只在"刚跨过目标线"那一刻触发（goalNonce 自增驱动）。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";

export function GoalCelebrate() {
  const { goalNonce, streak } = useProject();
  const { t } = useT();
  const [show, setShow] = useState(false);
  const firstRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false; // 首次挂载/初值不触发
      return;
    }
    if (goalNonce <= 0) return;
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 2600);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [goalNonce]);

  if (!show || typeof document === "undefined") return null;

  return createPortal(
    <div className="celebrate" role="status" aria-live="polite" onClick={() => setShow(false)}>
      <div className="celebrate-card">
        <span className="pcirc celebrate-portrait">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/portraits/cheer.png")} alt="" />
        </span>
        <div className="celebrate-spark" aria-hidden="true">
          <Icon name="flame" />
        </div>
        <h3>{t("daily.celebrateTitle")}</h3>
        <p>{streak > 0 ? t("daily.celebrateStreak", { n: streak }) : t("daily.celebrateSub")}</p>
      </div>
    </div>,
    document.body,
  );
}
