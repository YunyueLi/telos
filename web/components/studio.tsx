"use client";

// 书斋：形象经济的一级页。统一承载形象 · 画风 · 治学通行证 · 印章雅号 · 书斋装点 · 造型换装，
// 慢慢经营成你的样子。所有维度纯外观/荣誉，解锁绑真实学习，绝不影响掌握度与 XP。
import { useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { useProject } from "@/lib/telos/use-project";
import { PortraitGallery } from "@/components/portrait-gallery";
import { ThemePicker } from "@/components/theme-picker";
import { StudioPass } from "@/components/studio-pass";
import { StudioSeals } from "@/components/studio-seals";
import { StudioRoom } from "@/components/studio-room";
import { StudioDressup } from "@/components/studio-dressup";
import { passProgress } from "@/lib/telos/pass";

type StudioTab = "portrait" | "theme" | "pass" | "seal" | "studyroom" | "dressup";
const TABS: { k: StudioTab; label: string }[] = [
  { k: "portrait", label: "studio.tabPortrait" },
  { k: "theme", label: "studio.tabTheme" },
  { k: "pass", label: "studio.c.pass" },
  { k: "seal", label: "studio.c.seal" },
  { k: "studyroom", label: "studio.c.studyroom" },
  { k: "dressup", label: "studio.c.dressup" },
];

export function Studio() {
  const { t } = useT();
  const { projects } = useProject();
  const [tab, setTab] = useState<StudioTab>("portrait");
  const claimable = passProgress().claimableCount;

  return (
    <div className="studio">
      <header className="studio-hd">
        <h2>{t("studio.title")}</h2>
      </header>

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
        {tab === "portrait" && <PortraitGallery projects={projects} />}
        {tab === "theme" && (
          <div className="studio-theme">
            <p className="me-note" style={{ marginBottom: 14 }}>
              {t("theme.sub")}
            </p>
            <ThemePicker />
          </div>
        )}
        {tab === "pass" && <StudioPass />}
        {tab === "seal" && <StudioSeals projects={projects} />}
        {tab === "studyroom" && <StudioRoom projects={projects} />}
        {tab === "dressup" && <StudioDressup projects={projects} />}
      </div>
    </div>
  );
}
