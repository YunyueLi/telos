"use client";

// 「坚持」Tab：每日目标 · 连胜 · 打卡日历 · 断签保护（多邻国式激励中心）。
// 与 地图 / 复习 / 我 平行，位于复习之后。玩法全部集中于此，「我」只留档案 + 掌握 + 账户。
import { AppShell } from "@/components/app-shell";
import { StreakBoard } from "@/components/streak-board";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";

export default function StreakPage() {
  const { t } = useT();
  const { ready } = useProject();

  if (!ready) {
    return (
      <AppShell active="streak">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="streak">
      <StreakBoard />
    </AppShell>
  );
}
