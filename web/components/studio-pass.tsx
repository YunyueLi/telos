"use client";

// 治学通行证页签：季节进度长卷 + 免费/治学双轨奖励 + 领取。进度只读真实累计 XP，靠学推进。
import { useEffect, useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { BASE } from "@/lib/base";
import { isPro } from "@/lib/telos/billing";
import { passProgress, claimStep, claimAll, type PassProgress, type PassReward, type PassStepView } from "@/lib/telos/pass";
import { sealById, titleById } from "@/lib/telos/seals";
import { decorById } from "@/lib/telos/studyroom";

function ItemMark({ kind, id }: { kind: "seal" | "title" | "decor"; id: string }) {
  const { t } = useT();
  if (kind === "title") {
    const it = titleById(id);
    if (!it) return null;
    return (
      <span className="pass-item">
        <Icon name="medal" />
        {t(it.nameKey)}
      </span>
    );
  }
  const it = kind === "seal" ? sealById(id) : decorById(id);
  if (!it) return null;
  return (
    <span className="pass-item">
      <svg className="ic" aria-hidden style={{ color: kind === "seal" ? "var(--seal)" : "var(--ink)" }}>
        <use href={`#${kind === "seal" ? "s" : "d"}-${id}`} />
      </svg>
      {t(it.nameKey)}
    </span>
  );
}

function Rewards({ r }: { r: PassReward }) {
  const { t } = useT();
  return (
    <span className="pass-rw">
      <span className="pass-ink">
        {r.ink} {t("ink.unit")}
      </span>
      {r.sealId && <ItemMark kind="seal" id={r.sealId} />}
      {r.titleId && <ItemMark kind="title" id={r.titleId} />}
      {r.decorId && <ItemMark kind="decor" id={r.decorId} />}
    </span>
  );
}

function Step({ st, pro, onClaim }: { st: PassStepView; pro: boolean; onClaim: (i: number) => void }) {
  const { t } = useT();
  const state = !st.unlocked ? "locked" : st.claimable ? "ready" : "done";
  return (
    <li className={`pass-step ${state}`}>
      <span className="pass-node" aria-hidden>
        {st.unlocked && !st.claimable ? <Icon name="check" /> : st.i + 1}
      </span>
      <div className="pass-body">
        <div className="pass-body-top">
          <span className="pass-th">{st.xp === 0 ? t("pass.start") : `${st.xp} XP`}</span>
          {!st.unlocked ? (
            <span className="pass-state lock">
              <Icon name="lock" />
            </span>
          ) : st.claimable ? (
            <button className="pass-claim" onClick={() => onClaim(st.i)}>
              {t("pass.claim")}
            </button>
          ) : (
            <span className="pass-state done">{t("pass.claimed")}</span>
          )}
        </div>
        <div className="pass-track free">
          <span className="pass-tk">{t("pass.free")}</span>
          <Rewards r={st.free} />
        </div>
        <div className={`pass-track pro ${!pro ? "veil" : ""}`}>
          <span className="pass-tk">
            {t("pass.pro")}
            {!pro && <Icon name="lock" />}
          </span>
          <Rewards r={st.pro} />
        </div>
      </div>
    </li>
  );
}

// 横向赛道（桌面/横屏）：免费轨一行 · 节点轨道贯穿 · 治学轨一行，横向滚动——游戏通行证观感。
function HTrack({ prog, pro, onClaim }: { prog: PassProgress; pro: boolean; onClaim: (i: number) => void }) {
  const { t } = useT();
  const cls = (st: PassStepView) => (!st.unlocked ? "locked" : st.claimable ? "ready" : "done");
  return (
    <div className="pass-h">
      <div className="pass-h-scroll">
        <div className="pass-h-row">
          <span className="pass-h-lab">{t("pass.free")}</span>
          {prog.steps.map((st) => (
            <div key={st.i} className={`pass-h-cell ${cls(st)}`}>
              <Rewards r={st.free} />
            </div>
          ))}
        </div>
        <div className="pass-h-row pass-h-rail">
          <span className="pass-h-lab" aria-hidden />
          {prog.steps.map((st) => (
            <div key={st.i} className={`pass-h-railcell ${cls(st)}`}>
              <button
                className="pass-node"
                disabled={!st.claimable}
                onClick={() => st.claimable && onClaim(st.i)}
                title={st.claimable ? t("pass.claim") : st.unlocked ? t("pass.claimed") : `${st.xp} XP`}
              >
                {st.unlocked && !st.claimable ? <Icon name="check" /> : st.i + 1}
              </button>
            </div>
          ))}
        </div>
        <div className="pass-h-row">
          <span className="pass-h-lab">
            {t("pass.pro")}
            {!pro && <Icon name="lock" />}
          </span>
          {prog.steps.map((st) => (
            <div key={st.i} className={`pass-h-cell ${cls(st)} ${!pro ? "veil" : ""}`}>
              <Rewards r={st.pro} />
            </div>
          ))}
        </div>
        <div className="pass-h-row pass-h-xprow">
          <span className="pass-h-lab" aria-hidden />
          {prog.steps.map((st) => (
            <div key={st.i} className="pass-h-xp">
              {st.xp === 0 ? t("pass.start") : `${st.xp} XP`}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StudioPass() {
  const { t } = useT();
  const [, force] = useState(0);
  const [wide, setWide] = useState(false);
  const prog = passProgress();
  const pro = isPro();
  // 横屏/桌面走横向赛道，竖屏走竖向长卷（mount + resize/旋转时按视口宽度切换，避免 SSR 不一致）。
  useEffect(() => {
    const check = () => setWide(window.innerWidth >= 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const claim = (i: number) => {
    claimStep(i);
    force((n) => n + 1);
  };
  const claimEverything = () => {
    claimAll();
    force((n) => n + 1);
  };

  return (
    <div className="pass">
      <div className="pass-hero">
        <div className="eyebrow">
          {t(`pass.season.${prog.seasonKey}`)} · {t("pass.eyebrow")}
        </div>
        <div className="pass-prog">
          <div className="pass-prog-top">
            <b>{t("pass.stepN", { n: prog.curStep + 1 })}</b>
            <span>{prog.maxed ? t("pass.maxed") : t("pass.toNext", { n: prog.toNext })}</span>
          </div>
          <div className="pass-bar">
            <i style={{ width: `${Math.round(prog.pctToNext * 100)}%` }} />
          </div>
          <div className="pass-meta">{t("pass.totalXp", { n: prog.totalXp })}</div>
        </div>
        {prog.claimableCount > 0 && (
          <button className="pass-claimall" onClick={claimEverything}>
            <Icon name="check" />
            {t("pass.claimAll", { n: prog.claimableCount })}
          </button>
        )}
        {!pro && (
          <a className="pass-upsell" href={`${BASE}/pro`}>
            {t("pass.upsell")}
            <Icon name="arrow" />
          </a>
        )}
      </div>

      {wide ? (
        <HTrack prog={prog} pro={pro} onClaim={claim} />
      ) : (
        <ol className="pass-steps">
          {prog.steps.map((st) => (
            <Step key={st.i} st={st} pro={pro} onClaim={claim} />
          ))}
        </ol>
      )}

      <p className="pass-foot">{t("pass.foot")}</p>
    </div>
  );
}
