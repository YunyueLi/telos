"use client";

// 接入状态：三张能力卡（AI 引擎 / 联网搜索 / 跨设备同步），点卡片弹出对应配置。
// BYOK——用户自带 LLM 配置（API Key / 模型 / 接口地址），存本机 + 随账号同步，随请求发往服务、不落盘。
// 服务端点（处理倒推的 runtime）收进「自部署」高级，普通用户无需触碰。
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import {
  getDeriveUrl,
  setDeriveUrl,
  testEndpoint,
  getLlmConfig,
  setLlmConfig,
  cleanBaseUrl,
  LOCAL_ENDPOINT,
  LLM_EVENT,
  type EndpointStatus,
  type LlmConfig,
} from "@/lib/telos/derive";
import { useAuth } from "@/lib/telos/auth";
import { supabase } from "@/lib/telos/supabase";
import { useT } from "@/lib/telos/i18n";

const DEEPSEEK_KEYS_URL = "https://platform.deepseek.com/api_keys";
const MODEL_PRESETS = ["deepseek-v4-pro", "deepseek-v4-flash"];
const ENDPOINT_PRESETS = [
  { key: "worker", labelKey: "epc.worker", fill: "" }, // 构建期默认 endpoint
  { key: "local", labelKey: "epc.local", fill: LOCAL_ENDPOINT },
];

function provLabel(p?: string): string {
  if (p === "tavily") return "Tavily";
  if (p === "youtube") return "YouTube";
  return p && p !== "none" ? p : "";
}

export function EndpointConfig({ onSaved }: { onSaved?: (url: string) => void }) {
  const { t } = useT();
  const { configured: cloudCfg, user } = useAuth();
  const [status, setStatus] = useState<EndpointStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [modal, setModal] = useState<null | "ai" | "search">(null);

  // BYOK 配置草稿（打开弹层时从存储载入）
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [base, setBase] = useState("");
  const [baseErr, setBaseErr] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSk, setShowSk] = useState(false);
  const [ep, setEp] = useState(""); // 服务端点草稿
  const [epAdv, setEpAdv] = useState(false);

  async function runTest(u?: string) {
    setTesting(true);
    setStatus(null);
    const s = await testEndpoint(u ?? getDeriveUrl());
    setStatus(s);
    setTesting(false);
  }

  useEffect(() => {
    void runTest();
  }, []);

  // 配置变更（含登录后从账号拉回 BYOK 配置）→ 即时重测，状态卡随账号同步刷新。
  useEffect(() => {
    const h = () => void runTest();
    window.addEventListener(LLM_EVENT, h);
    return () => window.removeEventListener(LLM_EVENT, h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDrafts() {
    const c = getLlmConfig();
    setKey(c.key || "");
    setModel(c.model || "");
    setBase(cleanBaseUrl(c.base) || ""); // 规整显示：残留的非法地址（如 "DeepSeek"）显示为空 → 用默认
    setBaseErr(null);
    setSearchKey(c.searchKey || "");
    setEp(getDeriveUrl());
    setEpAdv(false);
  }
  function openAi() {
    loadDrafts();
    setModal("ai");
  }
  function openSearch() {
    loadDrafts();
    setModal("search");
  }

  function persist(next: LlmConfig, endpoint?: string) {
    setLlmConfig(next);
    if (endpoint !== undefined) {
      setDeriveUrl(endpoint.trim());
      onSaved?.(endpoint.trim());
    }
    if (user) {
      // 绑定到账号（user_metadata）。打日志便于确认推送是否成功——这是跨设备能拉到 key 的前提。
      supabase()
        ?.auth.updateUser({ data: { telos_llm: next } })
        .then((r) => console.info("[telos] BYOK push", r?.error ? { ok: false, error: r.error.message } : { ok: true }))
        .catch((e) => console.info("[telos] BYOK push", { ok: false, error: String(e) }));
    }
  }

  function saveAi() {
    const rawBase = base.trim();
    const cb = cleanBaseUrl(rawBase);
    if (rawBase && !cb) {
      setBaseErr(t("conn.baseInvalid")); // 填了但不是合法网址（如 "DeepSeek"）→ 提示并拦下，不保存
      return;
    }
    setBaseErr(null);
    const next: LlmConfig = {
      ...getLlmConfig(),
      key: key.trim() || undefined,
      model: model.trim() || undefined,
      base: cb,
      updatedAt: Date.now(),
    };
    persist(next, ep);
    setModal(null);
    void runTest(ep.trim() || undefined);
  }
  function saveSearch() {
    const next: LlmConfig = {
      ...getLlmConfig(),
      searchKey: searchKey.trim() || undefined,
      searchProvider: searchKey.trim() ? "tavily" : undefined,
      updatedAt: Date.now(),
    };
    persist(next);
    setModal(null);
    void runTest();
  }

  const llmOk = !!status?.ok && status.available !== false;
  const llmReachable = !!status?.ok;
  const searchOk = !!status?.search?.available;
  const spin = <span className="spinner" style={{ width: 12, height: 12 }} />;

  return (
    <div className="epc">
      <div className="conn">
        {/* AI 引擎 —— 点按配置 LLM */}
        <button className="conn-card" onClick={openAi}>
          <span className="conn-ic">
            <Icon name="spark" />
          </span>
          <div className="conn-main">
            <div className="conn-name">{t("conn.aiTitle")}</div>
            <div className="conn-sub">{t("conn.aiSub")}</div>
          </div>
          <div className="conn-stat">
            {testing ? (
              <>
                {spin} {t("epc.testing")}
              </>
            ) : llmOk ? (
              <>
                <span className="dot dot-ok" /> {t("conn.connected")}
                {status?.model && <b> · {status.model}</b>}
              </>
            ) : llmReachable ? (
              <>
                <span className="dot dot-off" /> {t("conn.noKey")}
              </>
            ) : (
              <>
                <span className="dot dot-off" /> {t("conn.offline")}
              </>
            )}
            <Icon name="arrow" className="conn-go" />
          </div>
        </button>

        {/* 联网搜索 —— 点按配置 */}
        <button className="conn-card" onClick={openSearch}>
          <span className="conn-ic">
            <Icon name="globe" />
          </span>
          <div className="conn-main">
            <div className="conn-name">{t("conn.searchTitle")}</div>
            <div className="conn-sub">{t("conn.searchSub")}</div>
          </div>
          <div className="conn-stat">
            {testing ? (
              <>
                {spin} {t("epc.testing")}
              </>
            ) : searchOk ? (
              <>
                <span className="dot dot-ok" /> {t("conn.enabled")}
                <b> · {provLabel(status?.search?.provider)}</b>
              </>
            ) : (
              <>
                <span className="dot dot-off" /> {t("conn.optional")}
              </>
            )}
            <Icon name="arrow" className="conn-go" />
          </div>
        </button>

        {/* 跨设备同步 —— 进 /account */}
        <Link href="/account" className="conn-card conn-card-link">
          <span className="conn-ic">
            <Icon name="refresh" />
          </span>
          <div className="conn-main">
            <div className="conn-name">{t("conn.syncTitle")}</div>
            <div className="conn-sub">{t("conn.syncSub")}</div>
          </div>
          <div className="conn-stat">
            {!cloudCfg ? (
              <>
                <span className="dot dot-off" /> {t("conn.optional")}
              </>
            ) : user ? (
              <>
                <span className="dot dot-ok" /> {t("auth.signedIn")}
              </>
            ) : (
              <>
                <span className="dot dot-off" /> {t("conn.signedOut")}
              </>
            )}
            <Icon name="arrow" className="conn-go" />
          </div>
        </Link>
      </div>

      {modal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="cfgm-back" onClick={() => setModal(null)} role="dialog" aria-modal="true">
            <div className="cfgm" onClick={(e) => e.stopPropagation()}>
              <div className="cfgm-head">
                <h3>{modal === "ai" ? t("conn.aiTitle") : t("conn.searchTitle")}</h3>
                <button className="cfgm-x" onClick={() => setModal(null)} aria-label={t("common.close")}>
                  <Icon name="x" />
                </button>
              </div>

              {cloudCfg && !user ? (
                <div className="cfgm-bind">
                  <p className="cfgm-lead">{t("conn.bindNote")}</p>
                  <Link href="/account" className="btn btn-ink cfgm-bind-cta" onClick={() => setModal(null)}>
                    {t("conn.bindSignIn")}
                  </Link>
                </div>
              ) : modal === "ai" ? (
                <>
                  <p className="cfgm-lead">{t("conn.aiCfgLead")}</p>

                  <label className="cfgm-field">
                    <span>{t("conn.fieldKey")}</span>
                    <div className="cfgm-pwd">
                      <input
                        type={showKey ? "text" : "password"}
                        placeholder="sk-..."
                        value={key}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        onChange={(e) => setKey(e.target.value)}
                      />
                      <button type="button" className="cfgm-eye" onClick={() => setShowKey((v) => !v)}>
                        {showKey ? t("auth.hide") : t("auth.show")}
                      </button>
                    </div>
                    <a className="cfgm-hint-link" href={DEEPSEEK_KEYS_URL} target="_blank" rel="noreferrer">
                      {t("conn.getKey")} <Icon name="arrow" />
                    </a>
                  </label>

                  <label className="cfgm-field">
                    <span>{t("conn.fieldModel")}</span>
                    <input
                      placeholder="deepseek-v4-pro"
                      value={model}
                      spellCheck={false}
                      autoCapitalize="off"
                      onChange={(e) => setModel(e.target.value)}
                    />
                    <div className="cfgm-chips">
                      {MODEL_PRESETS.map((m) => (
                        <button key={m} type="button" className={`cfgm-chip ${model === m ? "on" : ""}`} onClick={() => setModel(m)}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </label>

                  <label className="cfgm-field">
                    <span>{t("conn.fieldBase")}</span>
                    <input
                      placeholder="https://api.deepseek.com"
                      value={base}
                      spellCheck={false}
                      autoCapitalize="off"
                      inputMode="url"
                      aria-invalid={!!baseErr}
                      onChange={(e) => {
                        setBase(e.target.value);
                        if (baseErr) setBaseErr(null);
                      }}
                    />
                    {baseErr && <span className="cfgm-err">{baseErr}</span>}
                  </label>

                  <button className="cfgm-adv" onClick={() => setEpAdv((v) => !v)} aria-expanded={epAdv}>
                    <Icon name="chevron" className={epAdv ? "up" : ""} /> {t("conn.selfhost")}
                  </button>
                  {epAdv && (
                    <div className="cfgm-ep">
                      <div className="cfgm-chips">
                        {ENDPOINT_PRESETS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            className={`cfgm-chip ${ep.trim() === p.fill ? "on" : ""}`}
                            onClick={() => setEp(p.fill)}
                          >
                            {t(p.labelKey)}
                          </button>
                        ))}
                      </div>
                      <input
                        placeholder={LOCAL_ENDPOINT}
                        value={ep}
                        spellCheck={false}
                        autoCapitalize="off"
                        onChange={(e) => setEp(e.target.value)}
                      />
                    </div>
                  )}

                  {status && !status.ok && modal === "ai" && (
                    <div className="cfgm-status bad">
                      <span className="dot dot-off" /> {status.error}
                    </div>
                  )}

                  <div className="cfgm-actions">
                    <button className="btn btn-line" onClick={() => runTest(ep.trim() || undefined)} disabled={testing}>
                      {testing ? t("epc.testing") : t("epc.test")}
                    </button>
                    <button className="btn btn-ink" onClick={saveAi}>
                      {t("epc.save")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="cfgm-lead">{t("conn.searchCfgLead")}</p>
                  <label className="cfgm-field">
                    <span>{t("conn.fieldSearchKey")}</span>
                    <div className="cfgm-pwd">
                      <input
                        type={showSk ? "text" : "password"}
                        placeholder="tvly-..."
                        value={searchKey}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        onChange={(e) => setSearchKey(e.target.value)}
                      />
                      <button type="button" className="cfgm-eye" onClick={() => setShowSk((v) => !v)}>
                        {showSk ? t("auth.hide") : t("auth.show")}
                      </button>
                    </div>
                    <span className="cfgm-hint">{t("conn.searchHint")}</span>
                  </label>
                  <div className="cfgm-actions">
                    <button className="btn btn-ink" onClick={saveSearch}>
                      {t("epc.save")}
                    </button>
                  </div>
                </>
              )}

              <p className="cfgm-note">
                <Icon name="lock" /> {t("epc.note")}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
