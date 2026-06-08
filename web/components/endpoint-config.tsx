"use client";

// 接入状态（重构）：用户只看「需要接入什么 + 现在通不通」——AI 引擎 / 联网搜索两张能力卡 + 实时状态点。
// 技术细节（端点 URL、模式、测试/保存）收进「高级」折叠，给需要的人。key 永远在服务端，前端只选端点。
// 本机 localhost 零配置默认指向 serve.py，绝大多数用户无需展开高级。
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { getDeriveUrl, setDeriveUrl, testEndpoint, LOCAL_ENDPOINT, type EndpointStatus } from "@/lib/telos/derive";
import { useAuth } from "@/lib/telos/auth";
import { useT } from "@/lib/telos/i18n";

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
    if (u) void runTest(u);
    else setAdvanced(true);
  }, []);

  function save() {
    const v = draft.trim();
    setDeriveUrl(v);
    setSaved(v);
    onSaved?.(v);
    if (v) void runTest(v);
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
