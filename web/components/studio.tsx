"use client";

// 书斋：形象经济的一级页。统一承载「她(形象集) · 主题(成套美学)」,并以【锁定页签】预告
// 后续板块(造型换装 / 书斋装点 / 印章雅号 / 治学通行证)——一眼看全书斋全貌与野心。
// 现有形象集与主题迁入此处,作为后续所有外观个性化维度的容器。
import { useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { useProject } from "@/lib/telos/use-project";
import { PortraitGallery } from "@/components/portrait-gallery";
import { ThemePicker } from "@/components/theme-picker";

type StudioTab = "portrait" | "theme";
// 已开板块(on) + 预告板块(locked,灰显不可点)。立绘/功能就绪后把 on 改 true 即转正。
const TABS: { k: string; label: string; on: boolean }[] = [
  { k: "portrait", label: "studio.tabPortrait", on: true },
  { k: "theme", label: "studio.tabTheme", on: true },
  { k: "dressup", label: "studio.c.dressup", on: false },
  { k: "studyroom", label: "studio.c.studyroom", on: false },
  { k: "seal", label: "studio.c.seal", on: false },
  { k: "pass", label: "studio.c.pass", on: false },
];

export function Studio() {
  const { t } = useT();
  const { projects } = useProject();
  const [tab, setTab] = useState<StudioTab>("portrait");

  return (
    <div className="studio">
      <header className="studio-hd">
        <div className="eyebrow">{t("studio.eyebrow")}</div>
        <h2>{t("studio.title")}</h2>
        <p className="studio-lead">{t("studio.lead")}</p>
      </header>

      <div className="studio-tabs" role="tablist">
        {TABS.map((tb) =>
          tb.on ? (
            <button
              key={tb.k}
              role="tab"
              aria-selected={tab === tb.k}
              className={tab === tb.k ? "on" : ""}
              onClick={() => setTab(tb.k as StudioTab)}
            >
              {t(tb.label)}
            </button>
          ) : (
            <button key={tb.k} className="locked" disabled title={t("studio.comingTitle")}>
              <Icon name="clock" />
              {t(tb.label)}
            </button>
          ),
        )}
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
      </div>
    </div>
  );
}
