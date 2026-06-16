"use client";

// 造型换装页签：衣橱 / 试衣间。攒墨「请她换上」整套着装（确定性购买，非抽卡）+ 季节/里程碑限定。
// 纯外观、绝不影响学习；换上 = 当前看板娘（与形象集同源）。每套立绘入库后置 ready，未入库显示「绘制中」。
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { isPro } from "@/lib/telos/billing";
import type { Project } from "@/lib/telos/project";
import { collectStats, isUnlocked, unlockHint, portraitById, DEFAULT_PORTRAIT, type Portrait } from "@/lib/telos/portraits";
import { OUTFITS, ownsOutfit, outfitCost, buyOutfit, wearOutfit, wearDefault, isWearing, wearingDefault } from "@/lib/telos/wardrobe";
import { getInk } from "@/lib/telos/ink";

// 试衣镜卡已上移到书斋统一 anchor（StudioHero）；本组件只负责衣橱挂架与换上/购买。
export function StudioDressup({ projects, bump }: { projects: Project[]; bump?: () => void }) {
  const { t } = useT();
  const [, force] = useState(0);
  const refresh = () => {
    force((n) => n + 1);
    bump?.();
  };
  const stats = collectStats(projects, isPro());
  const ink = getInk().balance;

  const def = portraitById(DEFAULT_PORTRAIT)!;
  const onDefault = wearingDefault();

  const equip = (id: string) => { wearOutfit(id); refresh(); };
  const buy = (o: Portrait) => { if (buyOutfit(o)) { wearOutfit(o.id); refresh(); } };

  return (
    <div className="ward">
      <div className="ward-rack">
        {/* 默认 · 教师装（始终可换上） */}
        <button className={`ward-cell ${onDefault ? "on" : "ok"}`} onClick={() => { wearDefault(); refresh(); }} aria-label={t("dress.default")}>
          <span className="ward-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset(`/portraits/${def.file}.webp`)} alt="" loading="lazy" decoding="async" />
            {onDefault && <span className="ward-on"><Icon name="check" /></span>}
          </span>
          <span className="ward-name">{t("dress.default")}</span>
          <span className="ward-act">{onDefault ? t("dress.on") : t("dress.wear")}</span>
        </button>

        {OUTFITS.map((o) => {
          const worn = isWearing(o.id);
          const isInk = o.unlock.kind === "ink";
          const owned = isInk ? ownsOutfit(o.id) : isUnlocked(o, stats);
          const cost = outfitCost(o);
          const hint = unlockHint(o);
          let cls = "locked";
          let act: ReactNode = null;
          let onClick: (() => void) | undefined;
          let disabled = true;
          if (!o.ready) {
            act = (<><Icon name="clock" /> {t("dress.wip")}</>);
          } else if (worn) {
            cls = "on"; act = t("dress.on");
          } else if (owned) {
            cls = "ok"; act = t("dress.wear"); onClick = () => equip(o.id); disabled = false;
          } else if (isInk) {
            if (ink >= cost) { cls = "buy"; act = t("dress.buyWear", { n: cost }); onClick = () => buy(o); disabled = false; }
            else { act = t("dress.needInk", { n: cost }); }
          } else {
            act = t(hint.key, hint.vars); // 季节 / 里程碑 / Pro 限定
          }
          return (
            <button key={o.id} className={`ward-cell ${cls}`} onClick={onClick} disabled={disabled} aria-label={t(o.nameKey)}>
              <span className="ward-thumb">
                {o.ready ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset(`/portraits/${o.file}.webp`)} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="ward-wip-ic"><Icon name="user" /></span>
                )}
                {worn && <span className="ward-on"><Icon name="check" /></span>}
                {isInk && o.ready && !owned && (
                  <span className="ward-price"><Icon name="spark" />{cost}</span>
                )}
              </span>
              <span className="ward-name">{t(o.nameKey)}</span>
              <span className="ward-act">{act}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
