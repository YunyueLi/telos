"use client";

// 书斋：形象经济一级页。四大板块——形象（她的瞬间 + 造型）· 印记（雅号 + 印章）·
// 陈设（案头装点 + 纸色）· 通行证。顶部统一 anchor 贯穿全页，呈现「她 + 雅号 + 印 + 墨 + 进阶」。
// 概念分域（别串味）：「画风」=她被怎么画的笔法墨韵（泼墨/木刻，归形象 tab）；「纸色」=整个 App 的纸张色温（归陈设 tab）。
// 所有维度纯外观/荣誉，解锁绑真实学习，绝不影响掌握度与 XP。
import { useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { useProject } from "@/lib/telos/use-project";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { isPro } from "@/lib/telos/billing";
import { PortraitGallery } from "@/components/portrait-gallery";
import { ThemePicker } from "@/components/theme-picker";
import { StudioPass } from "@/components/studio-pass";
import { StudioSeals } from "@/components/studio-seals";
import { StudioRoom } from "@/components/studio-room";
import { StudioDressup } from "@/components/studio-dressup";
import { passProgress, getPassGranted } from "@/lib/telos/pass";
import {
  collectStats,
  isUnlocked,
  portraitById,
  getCurrentPortraitId,
  DEFAULT_PORTRAIT,
} from "@/lib/telos/portraits";
import {
  TITLES,
  SEALS,
  isTitleUnlocked,
  isSealUnlocked,
  getCurrentTitle,
  getCurrentSeal,
  titleById,
  sealById,
} from "@/lib/telos/seals";
import { getInk } from "@/lib/telos/ink";
import type { Project } from "@/lib/telos/project";

type StudioTab = "image" | "seal" | "room" | "pass";
const TABS: { k: StudioTab; label: string }[] = [
  { k: "image", label: "studio.t.image" }, // 形象（含造型）
  { k: "seal", label: "studio.t.mark" }, // 印记（雅号 + 印章）
  { k: "room", label: "studio.t.room" }, // 陈设（案头装点 + 纸色）
  { k: "pass", label: "studio.t.pass" }, // 通行证
];

// 贯穿全页的身份锚：她的当前样子 + 一句话 + 雅号/印/墨/进阶四枚速览。切 tab 不变，是书斋的「你」。
function StudioHero({ projects }: { projects: Project[] }) {
  const { t } = useT();
  const pro = isPro();
  const stats = collectStats(projects, pro);
  const granted = getPassGranted();

  const selP = portraitById(getCurrentPortraitId());
  const cur = selP && isUnlocked(selP, stats) ? selP : portraitById(DEFAULT_PORTRAIT)!;

  const ttl = titleById(getCurrentTitle());
  const title = ttl && isTitleUnlocked(ttl, stats, granted) ? ttl : TITLES[0];
  const sl = sealById(getCurrentSeal());
  const seal = sl && isSealUnlocked(sl, stats, granted) ? sl : SEALS[0];

  const ink = getInk().balance;
  const prog = passProgress();

  return (
    <div className="studio-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span className="pcirc studio-hero-face">
        <img src={asset(`/portraits/${cur.file}.webp`)} alt="" />
      </span>
      <div className="studio-hero-main">
        <span className="eyebrow">{t("pt.current")}</span>
        <b className="studio-hero-name">{t(cur.nameKey)}</b>
        {cur.voiceKey && <p className="studio-hero-voice">“{t(cur.voiceKey)}”</p>}
        <div className="studio-hero-chips">
          <span className="shchip">
            <Icon name="medal" />
            {t(title.nameKey)}
          </span>
          <span className="shchip seal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(`/seals/s-${seal.id}.webp`)} alt="" />
            {t(seal.nameKey)}
          </span>
          <span className="shchip">
            <Icon name="spark" />
            {t("dress.inkBal", { n: ink })}
          </span>
          <span className="shchip">
            <Icon name="flag" />
            {t("pass.stepN", { n: prog.curStep + 1 })}
          </span>
        </div>
      </div>
    </div>
  );
}

export function Studio() {
  const { t } = useT();
  const { projects } = useProject();
  const [tab, setTab] = useState<StudioTab>("image");
  const [, setRev] = useState(0);
  const bump = () => setRev((n) => n + 1); // 子板块改选当前形象/雅号/印 → 刷新顶部 anchor
  const claimable = passProgress().claimableCount;

  return (
    <div className="studio">
      <header className="studio-hd">
        <h2>{t("studio.title")}</h2>
      </header>

      <StudioHero projects={projects} />

      <div className="studio-tabs" role="tablist">
        {TABS.map((tb) => (
          <button
            key={tb.k}
            role="tab"
            aria-selected={tab === tb.k}
            className={tab === tb.k ? "on" : ""}
            onClick={() => setTab(tb.k)}
          >
            {t(tb.label)}
            {tb.k === "pass" && claimable > 0 && <i className="studio-dot">{claimable}</i>}
          </button>
        ))}
      </div>

      <div className="studio-body">
        {tab === "image" && (
          <div className="studio-stack">
            <PortraitGallery projects={projects} bump={bump} />
            <section className="studio-sect">
              <div className="pg-sh">
                <b>{t("studio.c.dressup")}</b>
                <span>{t("studio.c.dressup.s")}</span>
              </div>
              <StudioDressup projects={projects} bump={bump} />
            </section>
          </div>
        )}
        {tab === "seal" && <StudioSeals projects={projects} bump={bump} />}
        {tab === "room" && (
          <div className="studio-stack">
            <StudioRoom projects={projects} />
            <section className="studio-sect">
              <div className="pg-sh">
                <b>{t("studio.tabTheme")}</b>
                <span>{t("theme.sub")}</span>
              </div>
              <ThemePicker />
            </section>
          </div>
        )}
        {tab === "pass" && <StudioPass />}
      </div>
    </div>
  );
}
