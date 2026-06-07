"use client";

// 复习（全屏，项目级）：一个数字 + 一个按钮（N 项到期 → 复习），FSRS 评分写回项目。
// 依据 Anki/Duolingo Practice Hub：把复习收敛成"现在该复习什么"一个清晰入口。
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useProject } from "@/lib/telos/use-project";
import { AGAIN, EASY, GOOD, HARD } from "@/lib/telos/engine";

const GRADES = [
  { grade: AGAIN, label: "忘了", ink: false },
  { grade: HARD, label: "勉强", ink: false },
  { grade: GOOD, label: "记得", ink: true },
  { grade: EASY, label: "简单", ink: true },
] as const;

export default function ReviewPage() {
  const { ready, project, view, reviewCard } = useProject();
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
          <span className="spinner" /> 载入中…
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
            <h2>还没有要复习的</h2>
            <p>先说一个目标，倒推出学习地图、学几个能力点，它们就会进入这里的间隔复习。</p>
            <div className="rv-cta">
              <Link className="btn btn-ink" href="/">
                去定个目标 <Icon name="arrow" />
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
            <h2>{didSome ? "复习完成" : "今日已清空"}</h2>
            <p>
              {didSome
                ? `你复习了 ${reviewed} 个能力点，记忆又被推远了一点。`
                : "没有到期的卡片——保持节奏就好。学完新的能力点会按 FSRS 安排回这里。"}
            </p>
            <div className="rv-cta">
              <Link className="btn btn-ink" href="/">
                <Icon name="map" /> 回地图
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
                项到期
              </span>
              <div className="sub">间隔重复 · {project.goal}</div>
            </div>
          </div>

          {reviewed > 0 && (
            <div className="rv-bar">
              <span className="n">已复习 {reviewed}</span>
              <div className="rv-track">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="n">剩 {due.length}</span>
            </div>
          )}

          {card && (
            <div className="rv-card">
              <div className="rv-topic">
                <Icon name="refresh" /> 趁还没忘，回想一下
              </div>
              <h3 className="rv-name">{card.name}</h3>

              {!revealed ? (
                <>
                  <p className="rv-prompt">先在心里回想「{card.name}」的要点，再翻面如实评估。</p>
                  <button className="btn btn-line" onClick={() => setRevealed(true)}>
                    <Icon name="spark" /> 我想好了，翻面
                  </button>
                </>
              ) : (
                <>
                  <p className="rv-prompt">
                    对照你的记忆，如实评估掌握程度——评得越准，下次复习的时机越合适。
                  </p>
                  <div className="rv-gradelab">你记得多牢？</div>
                  <div className="rv-grades">
                    {GRADES.map((g) => (
                      <button
                        key={g.grade}
                        className={`btn ${g.ink ? "btn-ink" : "btn-line"}`}
                        style={{ justifyContent: "center" }}
                        onClick={() => grade(g.grade)}
                      >
                        {g.label}
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
