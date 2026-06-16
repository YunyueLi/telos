"use client";

// 看板娘形象集（集章册）。按系列分组展示已解锁/未解锁形象，选一个设为「当前陪伴」。
// 关系叙事：顶部 banner = 当前形象 + 她的一句话；未解锁 = 灰剪影空槽（催收集欲）+ 解锁条件。
// 形象是纯外观，不提供任何学习侧优势；解锁绑真实学习里程碑（见 portraits.ts 红线注释）。
import { useMemo, useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { isPro } from "@/lib/telos/billing";
import type { Project } from "@/lib/telos/project";
import {
  PORTRAITS,
  SERIES,
  collectStats,
  isUnlocked,
  unlockHint,
  getCurrentPortraitId,
  setCurrentPortraitId,
  type Portrait,
} from "@/lib/telos/portraits";

// 顶部「当前陪伴」卡已上移到书斋统一 anchor（StudioHero）；本组件只负责集章册分组与选择。
export function PortraitGallery({ projects, bump }: { projects: Project[]; bump?: () => void }) {
  const { t } = useT();
  const stats = useMemo(() => collectStats(projects, isPro()), [projects]);
  const [sel, setSel] = useState<string>(() => getCurrentPortraitId());

  const choose = (p: Portrait) => {
    setCurrentPortraitId(p.id);
    setSel(p.id);
    bump?.();
  };

  const groups = SERIES.map((s) => ({
    ...s,
    items: PORTRAITS.filter((p) => p.series === s.key),
  })).filter((g) => g.items.length > 0);
  // 还没立绘入库的系列 → "即将到来"预告（呈现 5 系列蓝图，制造收集期待；立绘入库即自动转为正式分组）
  const coming = SERIES.filter((s) => !PORTRAITS.some((p) => p.series === s.key));

  return (
    <div className="pg">
      {groups.map((g) => (
        <div key={g.key} className="pg-series">
          <div className="pg-sh">
            <b>{t(g.nameKey)}</b>
            <span>{t(g.subKey)}</span>
          </div>
          <div className="pg-grid">
            {g.items.map((p) => {
              const ok = isUnlocked(p, stats);
              const on = ok && sel === p.id;
              const hint = unlockHint(p);
              const label = ok ? t(p.nameKey) : t(hint.key, hint.vars);
              return (
                <button
                  key={p.id}
                  className={`pg-cell ${ok ? "ok" : "locked"} ${on ? "sel" : ""}`}
                  onClick={() => ok && choose(p)}
                  disabled={!ok}
                  title={label}
                  aria-label={label}
                >
                  <span className="pg-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset(`/portraits/${p.file}.webp`)} alt="" loading="lazy" decoding="async" />
                    {!ok && (
                      <span className="pg-veil">
                        <Icon name="lock" />
                      </span>
                    )}
                    {on && (
                      <span className="pg-on">
                        <Icon name="check" />
                      </span>
                    )}
                  </span>
                  <span className="pg-name">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {coming.length > 0 && (
        <div className="pg-coming">
          <div className="pg-sh">
            <b>{t("pt.coming")}</b>
          </div>
          <div className="pg-coming-list">
            {coming.map((s) => (
              <span key={s.key} className="pg-coming-chip">
                <Icon name="clock" />
                {t(s.nameKey)}
                <s>{t(s.subKey)}</s>
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="pg-more">{t("pt.more")}</p>
    </div>
  );
}
