"use client";

// 接入状态（重构）：用户只看「需要接入什么 + 现在通不通」——AI 引擎 / 联网搜索两张能力卡 + 实时状态点。
// 技术细节（端点 URL、模式、测试/保存）收进「高级」折叠，给需要的人。key 永远在服务端，前端只选端点。
// 本机 localhost 零配置默认指向 serve.py，绝大多数用户无需展开高级。
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import {
  getDeriveUrl,
  setDeriveUrl,
  testEndpoint,
  getLlmConfig,
  setLlmConfig,
  LOCAL_ENDPOINT,
  type EndpointStatus,
} from "@/lib/telos/derive";
import { useAuth } from "@/lib/telos/auth";
import { supabase } from "@/lib/telos/supabase";
import { useT } from "@/lib/telos/i18n";

const DEEPSEEK_KEYS_URL = "https://platform.deepseek.com/api_keys";

const PRESETS = [
  { key: "local", labelKey: "epc.local", fill: LOCAL_ENDPOINT },
  { key: "worker", labelKey: "epc.worker", fill: "https://你的子域.workers.dev/derive" },
];

function provLabel(p?: string): string {
  if (p === "tavily") return "Tavily";
  if (p === "youtube") return "YouTube";
  return p && p !== "none" ? p : "";
}

export function EndpointConfig({ onSaved }: { onSaved?: (url: string) => void }) {
  const { t } = useT();
  const { configured: cloudCfg, user } = useAuth();
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState<EndpointStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  // BYOK：用户自带的 LLM key / base / model（存 localStorage，登录后随账号同步）。
  const [llmKey, setLlmKey] = useState("");
  const [llmBase, setLlmBase] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState("");

  async function runTest(u: string) {
    setTesting(true);
    setStatus(null);
    const s = await testEndpoint(u);
    setStatus(s);
    setTesting(false);
    if (!(s.ok && s.available !== false)) setAdvanced(true); // 没接上 → 自动展开配置
  }

  useEffect(() => {
    const u = getDeriveUrl();
    setDraft(u);
    setSaved(u);
    const c = getLlmConfig();
    setLlmKey(c.key || "");
    setLlmBase(c.base || "");
    setLlmModel(c.model || "");
    setKeySaved(c.key || "");
    if (u) void runTest(u);
    if (!u || !(c.key || "").trim()) setAdvanced(true); // 没端点或没 key → 自动展开
  }, []);

  function save() {
    const v = draft.trim();
    setDeriveUrl(v);
    setSaved(v);
    onSaved?.(v);
    if (v) void runTest(v);
  }

  // 保存用户自带 key/base/model，并用新配置重测端点（key 经请求头发往端点，不进构建）。
  function saveKey() {
    const cfg = {
      ...getLlmConfig(),
      key: llmKey.trim() || undefined,
      base: llmBase.trim() || undefined,
      model: llmModel.trim() || undefined,
    };
    setLlmConfig(cfg);
    setKeySaved(llmKey.trim());
    // 登录后把 BYOK 配置同步到账号（Supabase user_metadata），跨设备带着走。
    if (user) supabase()?.auth.updateUser({ data: { telos_llm: cfg } }).catch(() => {});
    const u = saved.trim() || getDeriveUrl();
    if (u) void runTest(u);
  }

  const trimmed = draft.trim();
  const isPreset = PRESETS.some((p) => p.fill === trimmed);
  const active = PRESETS.find((p) => p.fill === trimmed)?.key ?? (trimmed ? "custom" : "");

  const llmOk = !!status?.ok && status.available !== false;
  const llmReachable = !!status?.ok;
  const searchOk = !!status?.search?.available;
  const spin = <span className="spinner" style={{ width: 12, height: 12 }} />;

  return (
    <div className="epc">
      <div className="conn">
        {/* AI 引擎 —— 必需 */}
        <div className="conn-card">
          <span className="conn-ic">
            <Icon name="spark" />
          </span>
          <div className="conn-main">
            <div className="conn-name">{t("conn.aiTitle")}</div>
            <div className="conn-sub">{t("conn.aiSub")}</div>
          </div>
          <div className="conn-stat">
            {testing ? (
              <>{spin} {t("epc.testing")}</>
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
          </div>
        </div>

        {/* 联网搜索 —— 可选增强 */}
        <div className="conn-card">
          <span className="conn-ic">
            <Icon name="globe" />
          </span>
          <div className="conn-main">
            <div className="conn-name">{t("conn.searchTitle")}</div>
            <div className="conn-sub">{t("conn.searchSub")}</div>
          </div>
          <div className="conn-stat">
            {testing ? (
              <>{spin} {t("epc.testing")}</>
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
          </div>
        </div>

        {/* 跨设备同步（账号）—— 登录后多设备同步，点进 /account 登录/管理 */}
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

      <button className="conn-adv-toggle" onClick={() => setAdvanced((v) => !v)} aria-expanded={advanced}>
        <Icon name="chevron" className={advanced ? "up" : ""} /> {t("conn.advanced")}
      </button>

      {advanced && (
        <div className="conn-adv">
          {/* BYOK：你自带的 LLM key —— 只存本机 + 你的账号，随请求发往端点，不落盘、不进构建 */}
          <div className="epc-key">
            <div className="epc-key-h">{t("conn.keyTitle")}</div>
            <p className="epc-key-sub">
              {t("conn.keySub")}{" "}
              <a href={DEEPSEEK_KEYS_URL} target="_blank" rel="noreferrer">
                {t("conn.keyGet")} <Icon name="arrow" />
              </a>
            </p>
            <div className="epc-row">
              <div className="auth-pwd" style={{ flex: 1 }}>
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={llmKey}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  onChange={(e) => setLlmKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveKey();
                  }}
                />
                <button type="button" className="auth-eye" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? t("auth.hide") : t("auth.show")}
                </button>
              </div>
              <button className="btn btn-ink epc-btn" onClick={saveKey} disabled={!llmKey.trim()}>
                {t("epc.save")}
              </button>
            </div>
            <div className="epc-row2">
              <input
                placeholder={t("conn.basePh")}
                value={llmBase}
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => setLlmBase(e.target.value)}
              />
              <input
                placeholder={t("conn.modelPh")}
                value={llmModel}
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => setLlmModel(e.target.value)}
              />
            </div>
          </div>

          <div className="epc-eplabel">{t("conn.epTitle")}</div>
          <div className="epc-chips">
            {PRESETS.map((p) => (
              <button key={p.key} className={`epc-chip ${active === p.key ? "on" : ""}`} onClick={() => setDraft(p.fill)}>
                {t(p.labelKey)}
              </button>
            ))}
            <button
              className={`epc-chip ${active === "custom" ? "on" : ""}`}
              onClick={() => {
                if (isPreset) setDraft("");
              }}
            >
              {t("epc.custom")}
            </button>
          </div>

          <div className="epc-row">
            <input
              placeholder={LOCAL_ENDPOINT}
              value={draft}
              spellCheck={false}
              autoCapitalize="off"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
            />
            <button className="btn btn-line epc-btn" onClick={() => runTest(draft)} disabled={testing || !trimmed}>
              {testing ? t("epc.testing") : t("epc.test")}
            </button>
            <button className="btn btn-ink epc-btn" onClick={save} disabled={trimmed === saved.trim()}>
              {t("epc.save")}
            </button>
          </div>

          {status && !status.ok && (
            <div className="epc-status bad">
              <span className="dot dot-off" /> {status.error}
            </div>
          )}

          <div className="epc-note">
            <Icon name="lock" style={{ width: 12, height: 12, verticalAlign: -2, marginRight: 5 }} />
            {t("epc.note")}
          </div>
        </div>
      )}
    </div>
  );
}
