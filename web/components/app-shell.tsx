"use client";

// 真实产品外壳：持续的顶部状态栏（品牌 + 当前目标 + 连胜/XP + 头像）
// 与移动端底部 Tab（地图 / 复习 / 我）。无 section 编号、无假浏览器框、无 Demo footer。
// 依据头部学习应用调研：单一目标 → 地图即主页；连胜/进度常驻顶栏；移动底部三 Tab。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { asset } from "@/lib/base";
import { useProject } from "@/lib/telos/use-project";

type Tab = "map" | "review" | "me";

const TABS: { key: Tab; href: string; icon: IconName; label: string }[] = [
  { key: "map", href: "/", icon: "map", label: "地图" },
  { key: "review", href: "/review", icon: "refresh", label: "复习" },
  { key: "me", href: "/me", icon: "user", label: "我" },
];

export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: Tab;
}) {
  const pathname = usePathname() ?? "/";
  const { project, view, xp, streak } = useProject();
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
            <Link className="appgoal" href="/me" title="点击管理 / 换目标">
              <span className="appgoal-l">目标</span>
              {project.goal}
            </Link>
          )}

          <nav className="appnav">
            {TABS.map((t) => (
              <Link key={t.key} href={t.href} className={tab === t.key ? "on" : ""}>
                <Icon name={t.icon} />
                {t.label}
                {t.key === "review" && due > 0 && <i className="appnav-badge">{due}</i>}
              </Link>
            ))}
          </nav>

          <div className="appstats">
            {streak > 0 && (
              <span className="appstat" title="连续学习天数">
                <Icon name="spark" /> {streak}
              </span>
            )}
            <span className="appstat" title="经验值（来自真实学习信号）">
              {xp} XP
            </span>
            <Link href="/me" className={`appavatar ${tab === "me" ? "on" : ""}`} aria-label="我">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/portraits/avatar.png")} alt="" />
            </Link>
          </div>
        </div>
      </header>

      <main className="appmain">{children}</main>

      <nav className="apptabs">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={tab === t.key ? "on" : ""}>
            <span className="apptab-ic">
              <Icon name={t.icon} />
              {t.key === "review" && due > 0 && <i className="apptab-badge">{due}</i>}
            </span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
