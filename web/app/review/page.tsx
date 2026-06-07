"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import {
  AGAIN,
  EASY,
  GOOD,
  HARD,
  KnowledgeGraph,
  SEED_GRAPH,
  dueReviews,
  newCard,
  review,
} from "@/lib/telos/engine";
import { useLearner } from "@/lib/telos/store";
import { type Project, loadProject, saveProject } from "@/lib/telos/project";
import styles from "./review.module.css";

const GRADES = [
  { grade: AGAIN, label: "忘了", ink: false },
  { grade: HARD, label: "勉强", ink: false },
  { grade: GOOD, label: "记得", ink: true },
  { grade: EASY, label: "简单", ink: true },
] as const;

export default function ReviewPage() {
  const L = useLearner();
  const [reviewed, setReviewed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // 有倒推项目就复习它（#2 复习闭环），否则回退到 seed 演示
  const [proj, setProj] = useState<Project | null>(null);
  useEffect(() => setProj(loadProject()), []);
  const projGraph = useMemo(() => (proj ? new KnowledgeGraph(proj.points) : null), [proj]);

  const due =
    projGraph && proj
      ? dueReviews(projGraph, proj.state).map(([id, r]) => ({ id, name: projGraph.get(id).name, r }))
      : L.due;
  const goalLabel = proj?.goal ?? null;

  const card = due[0] ?? null;
  const total = reviewed + due.length;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  function grade(g: number) {
    if (!card) return;
    if (projGraph && proj) {
      const next: Project["state"] = JSON.parse(JSON.stringify(proj.state));
      const c = next.cards[card.id] ?? newCard();
      next.cards[card.id] = review(c, g, next.day); // 纯 FSRS 重排
      next.version += 1;
      const np: Project = { ...proj, state: next, updatedAt: Date.now() };
      saveProject(np);
      setProj(np);
    } else {
      L.reviewCard(card.id, g);
    }
    setReviewed((n) => n + 1);
    setRevealed(false);
  }
  const nameOf = (id: string) =>
    projGraph ? projGraph.get(id).name : SEED_GRAPH.get(id).name;

  const shell = (body: React.ReactNode) => (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">05</span>
            <h2>复习</h2>
            <span className="sub">间隔重复 · 趁还没忘</span>
          </div>
          <div className="cap">
            <span>复习</span>
            <span>telos.app/review</span>
          </div>
          <div className="plate">
            <div className="ptop">
              <span className="u">telos.app/review</span>
              <span className="br">
                <i />
                <i />
                <i />
              </span>
            </div>
            {body}
          </div>
        </section>
      </div>
      <footer>
        <div className="wrap">TELOS — 从结果倒推，学会任何事 · 开源 Demo</div>
      </footer>
    </>
  );

  // Empty — nothing due, nothing reviewed yet today.
  if (due.length === 0 && reviewed === 0) {
    return shell(
      <div className={styles.done}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className={`pcirc ${styles.doneart}`}>
          <img src={asset("/portraits/empty.png")} alt="Telos 老师" />
        </span>
        <div className="eye mono">复习</div>
        <h2>今日已清空</h2>
        <p>没有要复习的——保持节奏就好。</p>
        <div className={styles.cta}>
          <Link className="btn btn-ink" href="/home">
            回到首页 <Icon name="arrow" />
          </Link>
        </div>
      </div>,
    );
  }

  // Completion — finished a session this visit.
  if (due.length === 0 && reviewed > 0) {
    return shell(
      <div className={styles.done}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className={`pcirc ${styles.doneart}`}>
          <img src={asset("/portraits/cheer.png")} alt="Telos 老师" />
        </span>
        <div className="eye mono">复习</div>
        <h2>复习完成</h2>
        <p>你复习了 {reviewed} 个知识点，记忆又被推远了一点。</p>
        <div className={styles.cta}>
          <Link className="btn btn-ink" href="/home">
            回到首页 <Icon name="arrow" />
          </Link>
          <Link className="btn btn-line" href="/map">
            <Icon name="map" /> 查看地图
          </Link>
        </div>
      </div>,
    );
  }

  // Active session — always show the current most-urgent due card.
  const hintName = card ? nameOf(card.id) : "";

  return shell(
    <>
      <div className={styles.bar}>
        <span className={styles.barn}>已复习 {reviewed}</span>
        <div className={styles.track}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.barloc}>剩 {due.length}</span>
      </div>

      {card && (
        <div className={styles.card}>
          <div className={styles.topic}>
            <Icon name="refresh" /> 间隔重复 · {goalLabel ?? "趁还没忘"}
          </div>
          <h3 className={styles.name}>{card.name}</h3>

          {!revealed ? (
            <>
              <p className={styles.prompt}>
                回想一下：「{card.name}」的要点是什么？
              </p>
              <button
                className={`btn btn-line ${styles.revealbtn}`}
                onClick={() => setRevealed(true)}
              >
                <Icon name="spark" /> 显示要点
              </button>
            </>
          ) : (
            <>
              <div className={`dark ${styles.hint}`}>
                <svg className="contour skL" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <g stroke="currentColor" fill="none" strokeWidth="1.4" opacity="0.13">
                    <path d="M-10 40C160 20 320 60 610 30" />
                    <path d="M-10 90C160 70 320 110 610 80" />
                    <path d="M-10 140C160 120 320 160 610 130" />
                  </g>
                </svg>
                <div className={styles.hintl}>这个知识点</div>
                <div className={styles.hintkey}>{hintName}</div>
                <div className={styles.hintd}>
                  对照你的记忆，如实评估掌握程度——评得越准，下次复习的时机越合适。
                </div>
              </div>
              <div className={`${styles.gradelab} mono`}>你记得多牢？</div>
              <div className={styles.grades}>
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    className={`btn ${g.ink ? "btn-ink" : "btn-line"}`}
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
    </>,
  );
}
