"use client";

// 头像账户下拉：取代「头像直接跳 /me」（与「我」Tab 重复）。点头像 → 弹出账户菜单：
// 登录态 + 我的 / 设置 / 退出登录(或登录)。portal 到 body，点外/滚动/缩放即关。
import { createPortal } from "react-dom";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { useAuth } from "@/lib/telos/auth";
import { useT } from "@/lib/telos/i18n";

const W = 244;

export function AccountMenu() {
  const { t } = useT();
  const { configured, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: Math.round(r.bottom) + 8, left: Math.max(8, Math.round(r.right) - W) });
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const doSignOut = async () => {
    setOpen(false);
    await signOut();
  };

  return (
    <div className="acctm-wrap">
      <button
        ref={btnRef}
        className="appavatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("auth.eyebrow")}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/portraits/avatar.png")} alt="" />
      </button>

      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={menuRef} className="selmenu acctm" role="menu" style={{ top: pos.top, left: pos.left, width: W }}>
            <div className="acctm-head">
              <span className={`dot ${user ? "dot-ok" : "dot-off"}`} />
              <div className="acctm-head-t">
                <b>{user ? t("auth.signedIn") : t("conn.signedOut")}</b>
                {user?.email && <span>{user.email}</span>}
              </div>
            </div>
            <div className="acctm-sep" />
            <Link href="/me" role="menuitem" className="acctm-item" onClick={close}>
              <Icon name="user" /> {t("nav.me")}
            </Link>
            <Link href="/settings" role="menuitem" className="acctm-item" onClick={close}>
              <Icon name="settings" /> {t("nav.settings")}
            </Link>
            <div className="acctm-sep" />
            {user ? (
              <button role="menuitem" className="acctm-item" onClick={doSignOut}>
                <Icon name="logout" /> {t("auth.signOut")}
              </button>
            ) : (
              <Link href="/account" role="menuitem" className="acctm-item" onClick={close}>
                <Icon name="mail" /> {configured ? t("auth.signIn") : t("auth.enableGuide")}
              </Link>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
