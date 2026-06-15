"use client";

// 造型换装页签：真换装强依赖逐套立绘资产，立绘绘制中——这里给诚实预览（蓝图 + 解锁规则预告），
// 不交假功能。立绘上新后接形象集同一套解锁逻辑（绑真实学习里程碑，绝不售卖学习优势）。
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";

const SETS = [
  { k: "robe", nameKey: "dress.robe", subKey: "dress.robe.s" },
  { k: "hanfu", nameKey: "dress.hanfu", subKey: "dress.hanfu.s" },
  { k: "casual", nameKey: "dress.casual", subKey: "dress.casual.s" },
  { k: "season", nameKey: "dress.season", subKey: "dress.season.s" },
];

export function StudioDressup() {
  const { t } = useT();
  return (
    <div className="dressup">
      <div className="dressup-lead">
        <span className="dressup-badge">
          <Icon name="clock" />
        </span>
        <div>
          <b>{t("dress.title")}</b>
          <p>{t("dress.lead")}</p>
        </div>
      </div>

      <div className="dressup-sets">
        {SETS.map((s) => (
          <div key={s.k} className="dressup-set">
            <b>{t(s.nameKey)}</b>
            <span>{t(s.subKey)}</span>
            <i className="dressup-wip">
              <Icon name="clock" />
              {t("dress.wip")}
            </i>
          </div>
        ))}
      </div>

      <p className="dressup-foot">{t("dress.foot")}</p>
    </div>
  );
}
