"use client";

// 语言切换：系统区的紧凑地球图标按钮，原生 select 叠加点开下拉。完整语言列表也在 /settings。落 localStorage telos:lang。
import { Icon } from "@/components/icon";
import { LANGS, useT, type Lang } from "@/lib/telos/i18n";

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div className="langsw" title={`${t("shell.langTitle")} · ${cur.label}`}>
      <Icon name="globe" />
      <select aria-label={t("shell.langTitle")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
