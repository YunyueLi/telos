"use client";

// 书斋页（形象经济一级页）：经「我」页入口进入,导航高亮「我」。
import { AppShell } from "@/components/app-shell";
import { Studio } from "@/components/studio";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";

export default function StudioPage() {
  const { t } = useT();
  const { ready } = useProject();

  if (!ready) {
    return (
      <AppShell active="me">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="me">
      <Studio />
    </AppShell>
  );
}
