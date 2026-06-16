"use client";

// 印章雅号页签：可佩戴学者雅号 + 朱红金石印（常用印钤完课证书）。解锁绑真实学习，纯荣誉。
import { useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { isPro } from "@/lib/telos/billing";
import { collectStats } from "@/lib/telos/portraits";
import { getPassGranted } from "@/lib/telos/pass";
import type { Project } from "@/lib/telos/project";
import {
  SEALS,
  TITLES,
  isSealUnlocked,
  isTitleUnlocked,
  itemHint,
  getCurrentSeal,
  getCurrentTitle,
  setCurrentSeal,
  setCurrentTitle,
  sealById,
  titleById,
} from "@/lib/telos/seals";

export function StudioSeals({ projects }: { projects: Project[] }) {
  const { t } = useT();
  const [, force] = useState(0);
  const stats = collectStats(projects, isPro());
  const granted = getPassGranted();
  const curSealId = getCurrentSeal();
  const curTitleId = getCurrentTitle();

  const wearTitle = (id: string) => {
    setCurrentTitle(id);
    force((n) => n + 1);
  };
  const useSeal = (id: string) => {
    setCurrentSeal(id);
    force((n) => n + 1);
  };

  const curSeal = sealById(curSealId);
  const curTitle = titleById(curTitleId);
  const sealOk = curSeal && isSealUnlocked(curSeal, stats, granted);
  const titleOk = curTitle && isTitleUnlocked(curTitle, stats, granted);

  const titlesUnlocked = TITLES.filter((x) => isTitleUnlocked(x, stats, granted)).length;
  const sealsUnlocked = SEALS.filter((x) => isSealUnlocked(x, stats, granted)).length;

  return (
    <div className="seals">
      <div className="seals-now">
        <span className="seals-now-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(`/seals/s-${sealOk ? curSeal!.id : "qicheng"}.webp`)} alt="" />
        </span>
        <div className="seals-now-info">
          <span className="eyebrow">{t("seal.current")}</span>
          <b>{t((titleOk ? curTitle! : TITLES[0]).nameKey)}</b>
          <span className="seals-now-sub">{t("seal.usingSeal", { name: t((sealOk ? curSeal! : SEALS[0]).nameKey) })}</span>
        </div>
      </div>

      <section className="seals-sect">
        <div className="seals-sh">
          <b>{t("seal.titles")}</b>
          <span>{t("seal.unlockedN", { n: titlesUnlocked, total: TITLES.length })}</span>
        </div>
        <div className="seals-titles">
          {TITLES.map((it) => {
            const ok = isTitleUnlocked(it, stats, granted);
            const on = ok && curTitleId === it.id;
            const hint = itemHint(it);
            return (
              <button
                key={it.id}
                className={`seal-title ${ok ? "ok" : "locked"} ${on ? "on" : ""}`}
                onClick={() => ok && wearTitle(it.id)}
                disabled={!ok}
                title={ok ? t(it.nameKey) : t(hint.key, hint.vars)}
              >
                {on && <Icon name="check" />}
                <span>{ok ? t(it.nameKey) : t(hint.key, hint.vars)}</span>
                {it.pro && !ok && <i className="seal-pro">Pro</i>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="seals-sect">
        <div className="seals-sh">
          <b>{t("seal.seals")}</b>
          <span>{t("seal.unlockedN", { n: sealsUnlocked, total: SEALS.length })}</span>
        </div>
        <div className="seals-grid">
          {SEALS.map((it) => {
            const ok = isSealUnlocked(it, stats, granted);
            const on = ok && curSealId === it.id;
            const hint = itemHint(it);
            const label = ok ? t(it.nameKey) : t(hint.key, hint.vars);
            return (
              <button
                key={it.id}
                className={`seal-cell ${ok ? "ok" : "locked"} ${on ? "on" : ""}`}
                onClick={() => ok && useSeal(it.id)}
                disabled={!ok}
                title={label}
                aria-label={label}
              >
                <span className="seal-stamp">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset(`/seals/s-${it.id}.webp`)} alt="" loading="lazy" decoding="async" />
                  {!ok && (
                    <span className="seal-veil">
                      <Icon name="lock" />
                    </span>
                  )}
                  {on && (
                    <span className="seal-on">
                      <Icon name="check" />
                    </span>
                  )}
                </span>
                <span className="seal-name">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="seals-foot">{t("seal.foot")}</p>
    </div>
  );
}
