"use client";

// 复习（全屏，项目级）：一个数字 + 一个按钮（N 项到期 → 复习），FSRS 评分写回项目。
// 依据 Anki/Duolingo Practice Hub：把复习收敛成"现在该复习什么"一个清晰入口。
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { AGAIN, EASY, GOOD, HARD } from "@/lib/telos/engine";

const GRADES = [
  { grade: AGAIN, labelKey: "rv.gradeAgain", ink: false },
  { grade: HARD, labelKey: "rv.gradeHard", ink: false },
  { grade: GOOD, labelKey: "rv.gradeGood", ink: true },
  { grade: EASY, labelKey: "rv.gradeEasy", ink: true },
] as const;

export default function ReviewPage() {
  const { ready, project, view, reviewCard } = useProject();
  const { t } = useT();
  const [reviewed, setReviewed] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const due = view?.due ?? [];
  const card = due[0] ?? null;
  const total = reviewed + due.length;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  function grade(g: number) {
    if (!card) return;
    reviewCard(card.id, g);
    setReviewed((n) => n + 1);
    setRevealed(false);
  }

  if (!ready) {
    return (
      <AppShell active="review">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  // 还没有目标项目
  if (!project) {
    return (
      <AppShell active="review">
        <div className="rv">
          <div className="rv-done">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pcirc">
              <img src={asset("/portraits/empty.png")} alt="Telos 老师" />
            </span>
            <h2>{t("rv.emptyTitle")}</h2>
            <p>{t("rv.emptyP")}</p>
            <div className="rv-cta">
              <Link className="btn btn-ink" href="/">
                {t("rv.emptyCta")} <Icon name="arrow" />
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // 今日清空
  if (due.length === 0) {
    const didSome = reviewed > 0;
    return (
      <AppShell active="review">
        <div className="rv">
          <div className="rv-done">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pcirc">
              <img src={asset(didSome ? "/portraits/cheer.png" : "/portraits/empty.png")} alt="Telos 老师" />
            </span>
            <h2>{didSome ? t("rv.doneTitle") : t("rv.clearedTitle")}</h2>
            <p>{didSome ? t("rv.doneP", { n: reviewed }) : t("rv.clearedP")}</p>
            <div className="rv-cta">
              <Link className="btn btn-ink" href="/">
                <Icon name="map" /> {t("rv.backMap")}
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="review">
      <div className="rv">
        <div className="rv-in">
          <div className="rv-lead">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pmini">
              <img src={asset("/portraits/notify.png")} alt="" />
            </span>
            <div className="lt">
              <span className="big">{due.length}</span>
              <span className="sub" style={{ display: "inline", marginLeft: 8 }}>
                {t("rv.dueUnit")}
              </span>
              <div className="sub">{t("rv.intervalGoal", { goal: project.goal })}</div>
            </div>
          </div>

          <p className="rv-wengu">{t("rv.wenguSays")}</p>

          {reviewed > 0 && (
            <div className="rv-bar">
              <span className="n">{t("rv.reviewed", { n: reviewed })}</span>
              <div className="rv-track">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="n">{t("rv.remain", { n: due.length })}</span>
            </div>
          )}

          {card && (
            <div className="rv-card">
              <div className="rv-topic">
                <Icon name="refresh" /> {t("rv.recallTopic")}
              </div>
              <h3 className="rv-name">{card.name}</h3>

              {!revealed ? (
                <>
                  <p className="rv-prompt">{t("rv.recallPrompt", { name: card.name })}</p>
                  <button className="btn btn-line" onClick={() => setRevealed(true)}>
                    <Icon name="spark" /> {t("rv.flip")}
                  </button>
                </>
              ) : (
                <>
                  <p className="rv-prompt">{t("rv.assessPrompt")}</p>
                  <div className="rv-gradelab">{t("rv.howWell")}</div>
                  <div className="rv-grades">
                    {GRADES.map((g) => (
                      <button
                        key={g.grade}
                        className={`btn ${g.ink ? "btn-ink" : "btn-line"}`}
                        style={{ justifyContent: "center" }}
                        onClick={() => grade(g.grade)}
                      >
                        {t(g.labelKey)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
