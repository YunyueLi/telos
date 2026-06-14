"use client";

// 解锁即庆祝：学习里程碑解锁新形象时，全局弹一次性祝贺（看板娘换新样子）。
// 监听学习状态变化(dailyVersion/projects)，对比已见基线(localStorage)，只为"新解锁"弹、且首次会话只记基线不刷屏。
import { useEffect, useRef, useState } from "react";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { isPro } from "@/lib/telos/billing";
import { asset } from "@/lib/base";
import { PORTRAITS, collectStats, isUnlocked } from "@/lib/telos/portraits";

const SEEN_KEY = "telos:portrait-seen";

export function PortraitUnlockToast() {
  const { ready, projects, dailyVersion } = useProject();
  const { t } = useT();
  const [show, setShow] = useState<{ file: string; nameKey: string } | null>(null);

  useEffect(() => {
    if (!ready) return;
    let seen: string[] = [];
    let firstEver = false;
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (raw === null) firstEver = true;
      else seen = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const stats = collectStats(projects, isPro());
    const unlockedIds = PORTRAITS.filter((p) => isUnlocked(p, stats)).map((p) => p.id);

    // 首次运行：记基线、不弹（老用户进来不被历史解锁刷屏）。
    if (firstEver) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds));
      } catch {
        /* ignore */
      }
      return;
    }
    const fresh = unlockedIds.filter((id) => !seen.includes(id));
    if (fresh.length) {
      const p = PORTRAITS.find((x) => x.id === fresh[fresh.length - 1]);
      if (p) setShow({ file: p.file, nameKey: p.nameKey });
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds));
      } catch {
        /* ignore */
      }
    }
  }, [ready, projects, dailyVersion]);

  useEffect(() => {
    if (!show) return;
    const id = setTimeout(() => setShow(null), 4200);
    return () => clearTimeout(id);
  }, [show]);

  if (!show) return null;
  return (
    <div className="puc" role="dialog" aria-live="polite" onClick={() => setShow(null)}>
      <div className="puc-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="pcirc puc-face">
          <img src={asset(`/portraits/${show.file}.png`)} alt="" />
        </span>
        <div className="puc-txt">
          <span className="eyebrow">{t("unlock.eyebrow")}</span>
          <b>{t(show.nameKey)}</b>
          <p>{t("unlock.sub")}</p>
        </div>
      </div>
    </div>
  );
}
