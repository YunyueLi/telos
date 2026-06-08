"use client";

// 语言切换：系统区的紧凑地球图标按钮，点开为自定义下拉（非系统框）。完整列表也在 /settings。落 localStorage telos:lang。
import { Icon } from "@/components/icon";
import { SelectMenu } from "@/components/select-menu";
import { LANGS, useT, type Lang } from "@/lib/telos/i18n";

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <SelectMenu
      value={lang}
      options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
      onChange={(v) => setLang(v as Lang)}
      ariaLabel={`${t("shell.langTitle")} · ${cur.label}`}
      className="langsw"
      buttonClassName="langsw-btn"
      align="end"
      trigger={() => <Icon name="globe" />}
    />
  );
}
