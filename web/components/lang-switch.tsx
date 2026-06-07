"use client";

// 语言切换（#7）：极简药丸，原生 select 叠加，跨桌面/移动可用。落 localStorage telos:lang。
import { LANGS, useT, type Lang } from "@/lib/telos/i18n";

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div className="langsw" title={t("shell.langTitle")}>
      <span className="langsw-cur">{cur.label}</span>
      <select
        aria-label={t("shell.langTitle")}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
