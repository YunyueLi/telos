"use client";

// 纸张主题选择器：色卡小样 + 即时切换（切到即整页变色）；Pro 款显示锁与 Pro 标记。
import { useState } from "react";
import { useT } from "@/lib/telos/i18n";
import { Icon } from "@/components/icon";
import { isPro } from "@/lib/telos/billing";
import { THEMES, getTheme, setTheme } from "@/lib/telos/theme";

export function ThemePicker() {
  const { t } = useT();
  const [cur, setCur] = useState<string>(() => getTheme());
  const pro = isPro();
  const choose = (id: string, paid: boolean) => {
    if (paid && !pro) return; // Pro 门槛：未购不可选
    setTheme(id);
    setCur(id);
  };
  return (
    <div className="tp">
      {THEMES.map((th) => {
        const locked = th.paid && !pro;
        const on = cur === th.id;
        return (
          <button
            key={th.id}
            className={`tp-cell ${on ? "on" : ""} ${locked ? "locked" : ""}`}
            onClick={() => choose(th.id, th.paid)}
            disabled={locked}
            aria-pressed={on}
            title={t(th.nameKey)}
          >
            <span className="tp-sw" style={{ background: th.swatch.paper, borderColor: th.swatch.ink }}>
              <i style={{ background: th.swatch.ink }} />
              {locked && <Icon name="lock" className="tp-lk" />}
            </span>
            <span className="tp-name">{t(th.nameKey)}</span>
            {locked && <span className="tp-pro">{t("theme.locked")}</span>}
          </button>
        );
      })}
    </div>
  );
}
