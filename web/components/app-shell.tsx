"use client";

// 真实产品外壳：持续的顶部状态栏（品牌 + 当前目标 + 连胜/XP + 头像）
// 与移动端底部 Tab（地图 / 复习 / 我）。无 section 编号、无假浏览器框、无 Demo footer。
// 依据头部学习应用调研：单一目标 → 地图即主页；连胜/进度常驻顶栏；移动底部三 Tab。
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { asset } from "@/lib/base";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { LangSwitch } from "@/components/lang-switch";

type Tab = "map" | "review" | "me";

const TABS: { key: Tab; href: string; icon: IconName; labelKey: string }[] = [
  { key: "map", href: "/", icon: "map", labelKey: "nav.map" },
  { key: "review", href: "/review", icon: "refresh", labelKey: "nav.review" },
  { key: "me", href: "/me", icon: "user", labelKey: "nav.me" },
];

export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: Tab;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { t } = useT();
  const { project, view, xp, streak, startNew } = useProject();
  const newLearning = () => {
    startNew();
    router.push("/");
  };
  const tab: Tab =
    active ??
    (pathname.startsWith("/review")
      ? "review"
      : pathname.startsWith("/me")
        ? "me"
        : "map");
  const due = view?.due.length ?? 0;

  return (
    <div className="appshell">
      <header className="appbar">
        <div className="appbar-in">
          <Link href="/" className="appbrand">
            <svg className="sk" viewBox="0 0 24 24" aria-hidden="true">
              <use href="#i-compass" />
            </svg>
            <span>Telos</span>
          </Link>

          {project && (
            <Link className="appgoal" href="/me" title={t("shell.goalTitle")}>
              <span className="appgoal-l">{t("shell.goalLabel")}</span>
              {project.goal}
            </Link>
          )}

          <nav className="appnav">
            {TABS.map((tb) => (
              <Link key={tb.key} href={tb.href} className={tab === tb.key ? "on" : ""}>
                <Icon name={tb.icon} />
                {t(tb.labelKey)}
                {tb.key === "review" && due > 0 && <i className="appnav-badge">{due}</i>}
              </Link>
            ))}
          </nav>

          <div className="appstats">
            <LangSwitch />
            <button className="appnew" onClick={newLearning} title={t("shell.newTitle")}>
              <Icon name="plus" /> <span className="appnew-t">{t("shell.new")}</span>
            </button>
            {streak > 0 && (
              <span className="appstat" title={t("shell.streakTitle")}>
                <Icon name="spark" /> {streak}
              </span>
            )}
            <span className="appstat" title={t("shell.xpTitle")}>
              {xp} XP
            </span>
            <Link href="/me" className={`appavatar ${tab === "me" ? "on" : ""}`} aria-label={t("nav.me")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/portraits/avatar.png")} alt="" />
            </Link>
          </div>
        </div>
      </header>

      <main className="appmain">{children}</main>

      <nav className="apptabs">
        {TABS.map((tb) => (
          <Link key={tb.key} href={tb.href} className={tab === tb.key ? "on" : ""}>
            <span className="apptab-ic">
              <Icon name={tb.icon} />
              {tb.key === "review" && due > 0 && <i className="apptab-badge">{due}</i>}
            </span>
            <span>{t(tb.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
