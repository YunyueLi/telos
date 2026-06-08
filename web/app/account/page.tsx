"use client";

// 账号页：登录 / 注册 / 退出 + 跨设备同步状态。OAuth/魔法链接回跳目标即此页（/account/）。
// 设计依据：单页、最少字段；显示/隐藏密码、无「确认密码」（提升转化）；社交按钮白底单色 logo；
// 友好错误 + 忘记密码（见 authgear / learnui / nngroup 调研）。未配置 Supabase 时优雅降级为本地优先说明。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useAuth, type OAuthProvider } from "@/lib/telos/auth";
import { useT } from "@/lib/telos/i18n";

const SUPABASE_DOC = "https://github.com/YunyueLi/telos/blob/main/SUPABASE.md";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 11v3.05h4.36c-.18 1.13-1.32 3.3-4.36 3.3a4.85 4.85 0 0 1 0-9.7c1.5 0 2.5.64 3.07 1.19l2.1-2.02C15.94 5.6 14.2 4.85 12 4.85a7.15 7.15 0 1 0 0 14.3c4.13 0 6.86-2.9 6.86-6.99 0-.47-.05-.83-.12-1.19H12Z" />
    </svg>
  );
}
function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 1.5A10.5 10.5 0 0 0 8.68 22c.53.1.72-.23.72-.5v-1.86c-2.92.63-3.54-1.4-3.54-1.4-.48-1.22-1.17-1.55-1.17-1.55-.95-.65.08-.64.08-.64 1.06.07 1.61 1.09 1.61 1.09.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.34-.27-4.79-1.17-4.79-5.2 0-1.15.41-2.09 1.09-2.83-.11-.27-.47-1.35.1-2.8 0 0 .88-.29 2.88 1.07a10 10 0 0 1 5.24 0c2-1.36 2.88-1.07 2.88-1.07.57 1.45.21 2.53.1 2.8.68.74 1.09 1.68 1.09 2.83 0 4.04-2.46 4.93-4.8 5.19.38.33.72.97.72 1.96v2.9c0 .28.19.61.73.5A10.5 10.5 0 0 0 12 1.5Z" />
    </svg>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { t } = useT();
  const { configured, ready, user, signInPassword, signUpPassword, signInMagicLink, signInOAuth, resetPassword } =
    useAuth();

  // 账户/同步都在统一的「我的」(/me)；此页只负责登录，登录成功（会话建立）即跳过去。
  useEffect(() => {
    if (ready && user) router.replace("/me");
  }, [ready, user, router]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  const mapErr = (raw?: string): string => {
    const s = (raw || "").toLowerCase();
    if (s.includes("invalid login") || s.includes("invalid credentials")) return t("auth.errInvalid");
    if (s.includes("already") && s.includes("registered")) return t("auth.errExists");
    if (s.includes("password should be") || s.includes("at least 6")) return t("auth.errPwdShort");
    if (s.includes("rate limit") || s.includes("too many")) return t("auth.errRate");
    if (s.includes("email") && (s.includes("invalid") || s.includes("valid"))) return t("auth.errEmail");
    return raw || t("auth.errGeneric");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setMsg({ kind: "err", text: t("auth.needEmail") });
    if (password.length < 6) return setMsg({ kind: "err", text: t("auth.errPwdShort") });
    setBusy(true);
    setMsg(null);
    if (mode === "signup") {
      const r = await signUpPassword(email, password);
      if (!r.ok) setMsg({ kind: "err", text: mapErr(r.error) });
      else if (r.needsConfirm) setMsg({ kind: "ok", text: t("auth.signUpDone") });
      // 否则会话已建立 → effect 跳转 /me
    } else {
      const r = await signInPassword(email, password);
      if (!r.ok) setMsg({ kind: "err", text: mapErr(r.error) });
      // 成功 → effect 跳转 /me
    }
    setBusy(false);
  };

  const doMagic = async () => {
    if (!email.trim()) return setMsg({ kind: "err", text: t("auth.needEmail") });
    setBusy(true);
    setMsg(null);
    const r = await signInMagicLink(email);
    setMsg(r.ok ? { kind: "ok", text: t("auth.magicSent") } : { kind: "err", text: mapErr(r.error) });
    setBusy(false);
  };

  const doReset = async () => {
    if (!email.trim()) return setMsg({ kind: "err", text: t("auth.needEmail") });
    setBusy(true);
    setMsg(null);
    const r = await resetPassword(email);
    setMsg(r.ok ? { kind: "ok", text: t("auth.resetSent") } : { kind: "err", text: mapErr(r.error) });
    setBusy(false);
  };

  const doOAuth = async (p: OAuthProvider) => {
    setBusy(true);
    setMsg(null);
    const r = await signInOAuth(p); // 成功则跳转离开页面
    if (!r.ok) {
      setMsg({ kind: "err", text: mapErr(r.error) });
      setBusy(false);
    }
  };

  // ---- 渲染 ----
  if (!ready) {
    return (
      <AppShell>
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </AppShell>
    );
  }

  // 未配置 Supabase → 本地优先说明
  if (!configured) {
    return (
      <AppShell>
        <div className="auth auth-narrow">
          <div className="auth-head">
            <span className="pcirc auth-portrait">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/portraits/think.png")} alt="" />
            </span>
            <div className="eyebrow">{t("auth.eyebrow")}</div>
            <h2>{t("auth.notConfigured")}</h2>
            <p className="auth-lead">{t("auth.notConfiguredP")}</p>
          </div>
          <a className="btn btn-ink auth-block" href={SUPABASE_DOC} target="_blank" rel="noreferrer">
            {t("auth.enableGuide")} <Icon name="arrow" />
          </a>
          <Link className="auth-back" href="/">
            <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> {t("auth.backHome")}
          </Link>
        </div>
      </AppShell>
    );
  }

  // 已登录 → 由上面的 effect 跳到统一的「我的」(/me)；这里给个过渡态
  if (user) {
    return (
      <AppShell>
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("auth.signedIn")}
        </div>
      </AppShell>
    );
  }

  // 未登录 → 登录 / 注册
  return (
    <AppShell>
      <div className="auth auth-narrow">
        <div className="auth-head">
          <span className="pcirc auth-portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset("/portraits/think.png")} alt="" />
          </span>
          <div className="eyebrow">{t("auth.eyebrow")}</div>
          <h2>{mode === "signin" ? t("auth.signIn") : t("auth.signUp")}</h2>
        </div>

        <div className="auth-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "on" : ""} onClick={() => { setMode("signin"); setMsg(null); }}>
            {t("auth.signIn")}
          </button>
          <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => { setMode("signup"); setMsg(null); }}>
            {t("auth.signUp")}
          </button>
        </div>

        <form className="auth-form" onSubmit={submitPassword}>
          <label className="auth-field">
            <span>{t("auth.email")}</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span>{t("auth.password")}</span>
            <div className="auth-pwd">
              <input
                type={showPwd ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
              <button type="button" className="auth-eye" aria-pressed={showPwd} onClick={() => setShowPwd((v) => !v)}>
                {showPwd ? t("auth.hide") : t("auth.show")}
              </button>
            </div>
          </label>
          {mode === "signin" && (
            <button type="button" className="auth-link" onClick={doReset} disabled={busy}>
              {t("auth.forgot")}
            </button>
          )}
          <button type="submit" className="btn btn-ink auth-block" disabled={busy}>
            {busy ? <span className="spinner spinner-light" /> : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
          </button>
        </form>

        {msg && <div className={`auth-msg ${msg.kind}`}>{msg.text}</div>}

        <div className="auth-or"><span>{t("auth.or")}</span></div>

        <div className="auth-alts">
          <button className="auth-social" onClick={doMagic} disabled={busy}>
            <Icon name="mail" /> {t("auth.magicLink")}
          </button>
          <button className="auth-social" onClick={() => doOAuth("google")} disabled={busy}>
            <GoogleMark /> {t("auth.withGoogle")}
          </button>
          <button className="auth-social" onClick={() => doOAuth("github")} disabled={busy}>
            <GithubMark /> {t("auth.withGithub")}
          </button>
        </div>

        <p className="auth-note">{t("auth.localNote")}</p>
        <Link className="auth-back" href="/">
          <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> {t("auth.backHome")}
        </Link>
      </div>
    </AppShell>
  );
}
