"use client";

// 书斋装点页签：墨线文房清玩，解锁后摆上「案头」（最多 PLACE_MAX 件），点缀你的一方书斋。
import { useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { isPro } from "@/lib/telos/billing";
import { collectStats } from "@/lib/telos/portraits";
import { getPassGranted } from "@/lib/telos/pass";
import type { Project } from "@/lib/telos/project";
import { DECOR, PLACE_MAX, isDecorUnlocked, decorHint, getPlaced, togglePlace, decorById } from "@/lib/telos/studyroom";

export function StudioRoom({ projects }: { projects: Project[] }) {
  const { t } = useT();
  const [, force] = useState(0);
  const stats = collectStats(projects, isPro());
  const granted = getPassGranted();
  const placed = getPlaced();

  const toggle = (id: string) => {
    togglePlace(id);
    force((n) => n + 1);
  };

  const unlocked = DECOR.filter((d) => isDecorUnlocked(d, stats, granted)).length;

  return (
    <div className="room">
      <div className="room-desk">
        {placed.length > 0 ? (
          <div className="room-shelf">
            {placed.map((id) => {
              const d = decorById(id);
              if (!d) return null;
              return (
                <span key={id} className="room-piece" title={t(d.nameKey)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(`/decor/d-${id}.png`)} alt="" />
                </span>
              );
            })}
          </div>
        ) : (
          <div className="room-empty">{t("room.empty")}</div>
        )}
        <span className="room-count">{t("room.placedN", { n: placed.length, total: PLACE_MAX })}</span>
      </div>

      <div className="room-grid">
        {DECOR.map((d) => {
          const ok = isDecorUnlocked(d, stats, granted);
          const on = ok && placed.includes(d.id);
          const hint = decorHint(d);
          const label = ok ? t(d.nameKey) : t(hint.key, hint.vars);
          return (
            <button
              key={d.id}
              className={`room-cell ${ok ? "ok" : "locked"} ${on ? "on" : ""}`}
              onClick={() => ok && toggle(d.id)}
              disabled={!ok}
              title={label}
              aria-label={label}
            >
              <span className="room-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(`/decor/d-${d.id}.png`)} alt="" />
                {!ok && (
                  <span className="room-veil">
                    <Icon name="lock" />
                  </span>
                )}
                {on && (
                  <span className="room-on">
                    <Icon name="check" />
                  </span>
                )}
              </span>
              <span className="room-name">{label}</span>
              {ok && <span className="room-act">{on ? t("room.placed") : t("room.place")}</span>}
            </button>
          );
        })}
      </div>

      <p className="room-foot">{t("room.foot")}</p>
    </div>
  );
}
