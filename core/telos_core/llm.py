"""Optional LLM-backed reverse derivation: a goal → a prerequisite knowledge graph.

Runs locally / server-side where the API key is PRIVATE (never in the static web
client — a key in front-end code is public). OpenAI-compatible; defaults to DeepSeek.
Config via environment (see core/.env.example):
    TELOS_LLM_API_KEY    your key — keep secret, never commit
    TELOS_LLM_BASE_URL   default https://api.deepseek.com
    TELOS_LLM_MODEL      default deepseek-chat
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from .models import KnowledgeGraph
from .prompts import (  # 公开 baseline prompt；owner 私有增强见 prompts_private.py（git-ignored，部署/自用时覆盖）
    _SYSTEM, _USER, _BLUEPRINT_SYSTEM, _BLUEPRINT_USER_TPL, _MODULE_SYSTEM, _MODULE_USER_TPL,
    _CRITIQUE_SYSTEM, _CRITIQUE_USER, _TITLE_SYSTEM, _TITLE_USER, _LESSON_SYSTEM, _LESSON_HEADER,
    _LESSON_STEPS, _LESSON_REQS, _STYLE_RULES, _PROBES_SYSTEM, _PROBES_USER,
)

_ENV_LOADED = False


def _load_env_file() -> None:
    """Best-effort: load core/.env into os.environ (no dependency on python-dotenv)."""
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    path = os.path.join(os.path.dirname(__file__), "..", ".env")
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass


def _config() -> tuple[str, str, str]:
    _load_env_file()
    key = os.environ.get("TELOS_LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY") or ""
    if key.startswith("sk-your") or key in ("", "changeme", "your-key-here"):
        key = ""  # treat placeholders as "not configured"
    base = os.environ.get("TELOS_LLM_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.environ.get("TELOS_LLM_MODEL", "deepseek-v4-pro")
    return key, base, model


def available() -> bool:
    return bool(_config()[0])


def search_status() -> dict:
    """联网搜索（Tavily/YouTube）接入状态，供 /health 透出给「接入」UI。"""
    provider, key = _search_config()
    return {"provider": provider, "available": provider not in ("", "none") and bool(key)}


def _thinking_off(model: str) -> dict:
    """DeepSeek V4 是「思考/非思考」双模、且思考为默认。倒推/微课/诊断要的是快速结构化 JSON，
    一律走非思考模式（更快、更省、不混入链式思考）。非 v4 模型不加此字段（旧模型 / 其它兼容厂商可能不识别）。"""
    return {"thinking": {"type": "disabled"}} if "v4" in str(model).lower() else {}


def _lang_directive(lang: str) -> str:
    """输出语言指令（#7 i18n）：让生成的面向学习者文本用指定语言；JSON 键名保持英文。缺省不限定。"""
    lang = (lang or "").strip()
    if not lang:
        return ""
    return (
        f"\n\n【输出语言】所有面向学习者的自然语言文本（名称 name / 描述 desc / 讲解 / 选项 / 题干 / "
        f"解析 / 资源名 等）必须用 {lang} 书写；JSON 的字段名(key)与枚举值(如 domain、kind)保持英文不变。"
    )


# ---- 联网检索（agentic grounding）：拿真实来源喂给模型，杜绝模型编造 URL ----
# 默认 provider=none（不联网，优雅降级回平台搜索链接）。配 TELOS_SEARCH_PROVIDER=tavily|youtube 启用。


def _search_config() -> tuple[str, str]:
    _load_env_file()
    provider = (os.environ.get("TELOS_SEARCH_PROVIDER") or "none").strip().lower()
    key = (os.environ.get("TELOS_SEARCH_API_KEY") or "").strip()
    if key.startswith("your") or key in ("", "changeme", "tvly-your-key-here"):
        key = ""
    return provider, key


def _domain_of(url: str) -> str:
    try:
        from urllib.parse import urlparse

        host = urlparse(url).netloc.lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def _search_tavily(query: str, key: str, k: int) -> list:
    body = json.dumps(
        {"api_key": key, "query": query, "max_results": max(1, min(k, 8)), "search_depth": "basic"}
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.tavily.com/search", data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for r in (data.get("results") or [])[:k]:
        url, title = str(r.get("url", "")).strip(), str(r.get("title", "")).strip()
        if url and title:
            out.append(
                {"title": title, "url": url, "snippet": str(r.get("content", "")).strip()[:200], "domain": _domain_of(url)}
            )
    return out


def _search_youtube(query: str, key: str, k: int) -> list:
    from urllib.parse import urlencode

    qs = urlencode(
        {"part": "snippet", "q": query, "type": "video", "maxResults": max(1, min(k, 8)),
         "key": key, "relevanceLanguage": "zh", "safeSearch": "moderate"}
    )
    req = urllib.request.Request("https://www.googleapis.com/youtube/v3/search?" + qs, method="GET")
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for it in data.get("items") or []:
        vid = (it.get("id") or {}).get("videoId")
        sn = it.get("snippet") or {}
        title = str(sn.get("title", "")).strip()
        if vid and title:
            out.append(
                {"title": title, "url": f"https://www.youtube.com/watch?v={vid}",
                 "snippet": str(sn.get("description", "")).strip()[:200], "domain": "youtube.com"}
            )
    return out


def web_search(query: str, k: int = 5) -> list:
    """联网检索真实来源，返回 [{title,url,snippet,domain}]；未配置/出错 → []（优雅降级，绝不抛错）。"""
    provider, key = _search_config()
    if not key or provider in ("", "none"):
        return []
    try:
        if provider == "tavily":
            return _search_tavily(query, key, k)
        if provider == "youtube":
            return _search_youtube(query, key, k)
    except Exception:
        return []
    return []


# prompt（倒推 / 微课 / 诊断）抽到 .prompts（公开 baseline，文件顶部 import）。


def _derive_context(goal: str) -> str:
    """倒推前联网检索真实课程/路径作背景，让能力图谱更贴合主流学习路径与真实术语。未配/出错 → ''。"""
    src = web_search(f"{goal} 学习路径 课程大纲 入门", k=4)
    if not src:
        return ""
    lines = "\n".join(
        f"- {s['title']}（{s['domain']}）" + (f"：{s['snippet'][:70]}" if s.get("snippet") else "") for s in src
    )
    return (
        "\n\n【联网参考资料（仅作背景）】以下为检索到的真实课程/资料标题与摘要——"
        "据此让能力节点更贴合主流学习路径与真实术语；务必提炼为【可训练能力】，不要照抄标题、不要堆知识点：\n" + lines
    )


# ============ 层级化倒推（多段 + 并行 fan-out）============
# 单发 LLM 只产 10-16 个节点、易截断、无层级 → 框架稀疏。改为研究印证的「蓝图→并行模块展开→合并/断环」：
#   ① 蓝图：判定广度档位，倒推出有序模块大纲 + 终点目标节点；
#   ② 模块展开：每模块并行各一发，产可练能力节点（Bloom 动词 + can-do + drill + 量化达标线 + 模块内前置 + 跨模块文本 hint）；
#   ③ 合并：去重、跨模块 hint→真边、模块按阶段链接、单一目标终点、断环、按广度封顶。
# 任一段失败优雅回退到单发倒推，绝不退化为不可用。


def _chat_json(system: str, user: str, lang: str = "", timeout: float = 90.0, temperature: float = 0.2) -> dict:
    key, base, model = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key（见 core/.env.example）。")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user + _lang_directive(lang)},
        ],
        "temperature": temperature,
        "stream": False,
        "response_format": {"type": "json_object"},
        **_thinking_off(model),
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败 HTTP {e.code}（检查 key / base_url / model）") from e
    return json.loads(data["choices"][0]["message"]["content"])




def _blueprint(goal: str, ctx: str, lang: str, timeout: float = 70.0) -> dict:
    spec = _chat_json(_BLUEPRINT_SYSTEM, _BLUEPRINT_USER_TPL.replace("__GOAL__", goal) + ctx, lang, timeout=timeout)
    if not isinstance(spec, dict):
        raise RuntimeError("蓝图返回格式错误")
    mods = [
        m for m in (spec.get("modules") or [])
        if isinstance(m, dict) and str(m.get("id", "")).strip() and str(m.get("title", "")).strip()
    ]
    if len(mods) < 2:
        raise RuntimeError("蓝图模块过少")
    seen, clean = set(), []
    for i, m in enumerate(mods[:9]):
        mid = str(m["id"]).strip()
        if mid in seen:
            continue
        seen.add(mid)
        m["id"] = mid
        m["order"] = int(m.get("order")) if str(m.get("order", "")).strip().lstrip("-").isdigit() else i + 1
        clean.append(m)
    spec["modules"] = clean
    return spec


def _expand_module(goal: str, bp: dict, module: dict, lang: str, timeout: float = 95.0) -> list:
    try:
        target = max(4, min(int(module.get("target")), 12))
    except (TypeError, ValueError):
        target = 8
    modlist = "、".join(str(m.get("title", "")) for m in bp["modules"])
    user = (
        _MODULE_USER_TPL.replace("__GOAL__", goal)
        .replace("__MODLIST__", modlist)
        .replace("__GOALNAME__", str((bp.get("goal") or {}).get("name", goal)))
        .replace("__MID__", str(module["id"]))
        .replace("__MTITLE__", str(module.get("title", "")))
        .replace("__MSUM__", str(module.get("summary", "")))
        .replace("__TARGET__", str(target))
    )
    spec = _chat_json(_MODULE_SYSTEM, user, lang, timeout=timeout, temperature=0.3)
    nodes = spec.get("nodes") if isinstance(spec, dict) else None
    return nodes if isinstance(nodes, list) else []


def _parallel_expand(goal: str, bp: dict, lang: str, emit=None) -> dict:
    mods = bp["modules"]
    out: dict = {}
    total = len(mods)
    done = 0
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(mods)))) as ex:
        futs = {ex.submit(_expand_module, goal, bp, m, lang): m["id"] for m in mods}
        # as_completed 在主线程逐个 yield → 在这里 emit 进度是线程安全的（无需加锁）。
        for fut in as_completed(futs):
            mid = futs[fut]
            try:
                out[mid] = fut.result()
            except Exception:  # noqa: BLE001 — 单模块失败不拖垮整体
                out[mid] = []
            done += 1
            if emit:
                try:
                    emit({"t": "module", "id": str(mid), "done": done, "total": total})
                except Exception:  # noqa: BLE001 — emit 失败不影响倒推
                    pass
    return out


def _norm(s: str) -> str:
    return re.sub(r"[\s\W_]+", "", str(s).lower())


def _bigrams(s: str) -> list:
    return [s[i : i + 2] for i in range(len(s) - 1)] if len(s) >= 2 else ([s] if s else [])


def _clean_node(n: dict) -> dict:
    return {k: n[k] for k in ("id", "name", "prereqs", "is_goal", "minutes", "domain", "desc", "drill", "benchmark", "module", "module_title")}


def _break_cycles(nodes: dict) -> None:
    """反复找一条环上的回边并删掉(沿 prereq 反向 DFS)，直到无环。"""

    def find_back_edge():
        color = {g: 0 for g in nodes}  # 0=white 1=gray 2=black

        def dfs(u):
            color[u] = 1
            for v in list(nodes[u]["prereqs"]):
                if v not in nodes:
                    continue
                if color[v] == 1:
                    return (u, v)
                if color[v] == 0:
                    r = dfs(v)
                    if r:
                        return r
            color[u] = 2
            return None

        for g in list(nodes):
            if color[g] == 0:
                r = dfs(g)
                if r:
                    return r
        return None

    for _ in range(5000):
        be = find_back_edge()
        if not be:
            break
        u, v = be
        if v in nodes[u]["prereqs"]:
            nodes[u]["prereqs"].remove(v)


def _cap_nodes(nodes: dict, goal_gid: str, limit: int = 82) -> None:
    while len(nodes) > limit:
        has_dep = set()
        for n in nodes.values():
            for p in n["prereqs"]:
                has_dep.add(p)
        cands = [g for g in nodes if g != goal_gid and g not in has_dep and not nodes[g]["is_goal"]]
        if not cands:
            break
        drop = sorted(cands, key=lambda g: (-len(nodes[g]["prereqs"]), g))[0]
        del nodes[drop]
        for n in nodes.values():
            if drop in n["prereqs"]:
                n["prereqs"].remove(drop)


def _assemble(goal: str, bp: dict, expansions: dict) -> dict:
    mods = sorted(bp["modules"], key=lambda m: int(m.get("order", 0)))
    order_of = {m["id"]: i for i, m in enumerate(mods)}
    nodes: dict = {}
    name_index: dict = {}
    remap: dict = {}
    mod_nodes = {m["id"]: [] for m in mods}

    for m in mods:
        mid, mtitle = m["id"], str(m.get("title", ""))
        for raw in expansions.get(mid, []):
            if not isinstance(raw, dict):
                continue
            lid = str(raw.get("id", "")).strip() or _norm(raw.get("name", ""))[:24]
            name = str(raw.get("name", "") or lid).strip()
            if not lid or not name:
                continue
            gid = f"{mid}.{lid}"
            if gid in nodes:
                gid = f"{gid}~{len(nodes)}"
            nm = _norm(name)
            if nm and nm in name_index:
                remap[gid] = name_index[nm]
                continue
            try:
                mins = max(5, min(int(raw.get("minutes")), 180))
            except (TypeError, ValueError):
                mins = 30
            nodes[gid] = {
                "id": gid, "name": name,
                "domain": str(raw.get("domain") or m.get("domain") or bp.get("domain") or "B"),
                "minutes": mins,
                "desc": re.sub(r"^\s*can-?do\s*[:：]\s*", "", str(raw.get("desc", "")).strip(), flags=re.I),
                "drill": str(raw.get("drill", "")).strip(),
                "benchmark": str(raw.get("benchmark", "")).strip(),
                "module": mid, "module_title": mtitle,
                "_pids": [f"{mid}.{str(x).strip()}" for x in (raw.get("prereq_ids") or []) if str(x).strip()],
                "_hints": [str(x).strip() for x in (raw.get("prereq_hints") or []) if str(x).strip()],
                "is_goal": False,
            }
            if nm:
                name_index[nm] = gid
            mod_nodes[mid].append(gid)

    # 终点目标节点(来自蓝图，保证唯一)
    gspec = bp.get("goal") or {}
    gmid = str(gspec.get("module", "")).strip()
    if gmid not in order_of:
        gmid = mods[-1]["id"]
    ggid = f"{gmid}.{str(gspec.get('id', 'goal')).strip() or 'goal'}"
    while ggid in nodes:
        ggid += "_g"
    nodes[ggid] = {
        "id": ggid, "name": str(gspec.get("name") or goal).strip(),
        "domain": str(gspec.get("domain") or bp.get("domain") or "B"),
        "minutes": 45,
        "desc": re.sub(r"^\s*can-?do\s*[:：]\s*", "", str(gspec.get("desc", "")).strip(), flags=re.I),
        "drill": str(gspec.get("drill", "")).strip(),
        "benchmark": str(gspec.get("benchmark", "")).strip(),
        "module": gmid, "module_title": next((str(m.get("title", "")) for m in mods if m["id"] == gmid), ""),
        "_pids": [], "_hints": [], "is_goal": True,
    }
    mod_nodes.setdefault(gmid, []).append(ggid)

    def fix(ids):
        out = []
        for x in ids:
            x = remap.get(x, x)
            if x in nodes and x not in out:
                out.append(x)
        return out

    for n in nodes.values():
        n["prereqs"] = fix(n.get("_pids", []))

    # 跨模块 hint → 真边(按名字 bigram 重合度匹配，阈值 0.5)
    name_norm = {gid: _norm(nd["name"]) for gid, nd in nodes.items()}
    for gid, n in nodes.items():
        for hint in n.get("_hints", []):
            h = _norm(hint)
            if len(h) < 2:
                continue
            hb = set(_bigrams(h))
            best, bestscore = None, 0.0
            for cand, cnm in name_norm.items():
                if cand == gid or nodes[cand]["module"] == n["module"] or not cnm:
                    continue
                if h in cnm or cnm in h:
                    score = min(len(h), len(cnm)) / max(len(h), len(cnm))
                else:
                    cb = set(_bigrams(cnm))
                    score = len(hb & cb) / len(hb | cb) if (hb and cb) else 0.0
                if score > bestscore:
                    best, bestscore = cand, score
            if best and bestscore >= 0.5 and best not in n["prereqs"]:
                n["prereqs"].append(best)

    # 模块代表节点(每模块最后一个非目标节点，作递进锚)
    rep = {}
    for m in mods:
        members = [g for g in mod_nodes.get(m["id"], []) if not nodes[g]["is_goal"]]
        if members:
            rep[m["id"]] = members[-1]

    # 模块链接：后续模块里没有任何前置的孤儿 → 挂到上一模块代表(保证连通且按阶段递进)
    for m in mods:
        idx = order_of[m["id"]]
        if idx == 0:
            continue
        prev = rep.get(mods[idx - 1]["id"])
        if not prev:
            continue
        for gid in mod_nodes.get(m["id"], []):
            if not nodes[gid]["is_goal"] and not nodes[gid]["prereqs"]:
                nodes[gid]["prereqs"] = [prev]

    # 目标前置：最后模块的 sink 节点(无人依赖)，否则该模块全部，否则各模块代表
    has_dep = set()
    for n in nodes.values():
        for p in n["prereqs"]:
            has_dep.add(p)
    last_members = [g for g in mod_nodes.get(gmid, []) if g != ggid]
    last_sinks = [g for g in last_members if g not in has_dep]
    gpre = fix(last_sinks or last_members)
    if not gpre:
        gpre = [rep[m["id"]] for m in mods if rep.get(m["id"]) and rep[m["id"]] != ggid]
    nodes[ggid]["prereqs"] = [p for p in gpre if p != ggid]

    _break_cycles(nodes)
    _cap_nodes(nodes, ggid, limit=82)

    points, seen = [], set()
    for m in mods:
        for gid in mod_nodes.get(m["id"], []):
            if gid in nodes and gid not in seen:
                points.append(_clean_node(nodes[gid]))
                seen.add(gid)
    for gid, n in nodes.items():
        if gid not in seen:
            points.append(_clean_node(n))
            seen.add(gid)
    return {"title": str(bp.get("title", "")).strip(), "points": points}


def _derive_single_spec(goal: str, ctx: str, lang: str, timeout: float) -> dict:
    """回退：单发倒推(老逻辑)，产 ~10-16 个节点的 spec。"""
    spec = _chat_json(_SYSTEM, _USER.format(goal=goal) + ctx, lang, timeout=timeout)
    pts = spec.get("points") if isinstance(spec, dict) else None
    if not pts:
        raise RuntimeError("LLM 返回缺少 points 字段")
    out = []
    for p in pts:
        if not isinstance(p, dict) or not str(p.get("id", "")).strip():
            continue
        pre = p.get("prerequisites")
        if pre is None:
            pre = p.get("prereqs") or []
        out.append({
            "id": str(p["id"]), "name": str(p.get("name", p["id"])),
            "prereqs": [str(x) for x in pre], "is_goal": bool(p.get("is_goal", False)),
            "minutes": int(p["minutes"]) if str(p.get("minutes", "")).strip().isdigit() else 25,
            "domain": str(p.get("domain", "B")), "desc": str(p.get("desc", "")),
            "drill": str(p.get("drill", "")), "benchmark": str(p.get("benchmark", "")),
            "module": "", "module_title": "",
        })
    return {"title": str(spec.get("title", "")).strip(), "points": out}


# ===== 对抗式专家审查 + 自动修补（镜像 derive-direct.ts / workers/derive.js）=====


def _norm_points(spec: dict) -> list:
    out = []
    for p in spec.get("points", []) or []:
        pre = p.get("prereqs")
        if pre is None:
            pre = p.get("prerequisites") or []
        out.append({
            "id": str(p["id"]), "name": str(p.get("name", p["id"])),
            "prereqs": [str(x) for x in pre], "is_goal": bool(p.get("is_goal", False)),
            "minutes": p.get("minutes", 25), "domain": str(p.get("domain", "B")),
            "desc": str(p.get("desc", "")), "drill": str(p.get("drill", "")),
            "benchmark": str(p.get("benchmark", "")), "module": str(p.get("module", "")),
            "module_title": str(p.get("module_title", p.get("moduleTitle", ""))),
        })
    return out


def _break_cycles_raw(points: list) -> None:
    by_id = {p["id"]: p for p in points}

    def find_back():
        color = {p["id"]: 0 for p in points}
        found = [None]

        def visit(u):
            color[u] = 1
            for v in list(by_id[u].get("prereqs", [])):
                if v not in by_id:
                    continue
                if color[v] == 1:
                    found[0] = (u, v)
                    return True
                if color[v] == 0 and visit(v):
                    return True
            color[u] = 2
            return False

        for p in points:
            if color[p["id"]] == 0 and visit(p["id"]):
                return found[0]
        return None

    for _ in range(5000):
        be = find_back()
        if not be:
            break
        pre = by_id[be[0]].get("prereqs", [])
        if be[1] in pre:
            pre.remove(be[1])


def _critique_and_repair(goal: str, spec: dict, lang: str, timeout: float) -> dict:
    points = _norm_points(spec)
    if len(points) < 5:
        spec["points"] = points
        return spec
    rows = []
    for p in points:
        pre = " ".join(p["prereqs"]) or "无"
        bm = ("｜ 达标:" + p["benchmark"][:36]) if p["benchmark"] else ""
        rows.append(f"- {p['id']} ｜ {p['name']} ｜ {p['domain']} ｜ 前置[{pre}]{bm}")
    try:
        rep = _chat_json(_CRITIQUE_SYSTEM, _CRITIQUE_USER.format(goal=goal, rows="\n".join(rows)), lang, timeout=timeout, temperature=0.2)
    except Exception:  # noqa: BLE001 — 审查失败则原图不动
        spec["points"] = points
        return spec

    def arr(v):
        return v if isinstance(v, list) else []

    by_id = {p["id"]: p for p in points}

    def mod_title(mid):
        for p in points:
            if p["module"] == mid:
                return p["module_title"]
        return ""

    valid = {"A", "B", "C", "D", "E", "F"}
    for r in arr(rep.get("renames")):
        p = by_id.get(str(r.get("id")))
        name = str(r.get("name", "")).strip()
        if p and name and len(name) <= 42:
            p["name"] = name
    for b in arr(rep.get("benchmarks")):
        p = by_id.get(str(b.get("id")))
        bm = str(b.get("benchmark", "")).strip()
        if p and bm:
            p["benchmark"] = bm
    for e in arr(rep.get("remove_prereqs")):
        p = by_id.get(str(e.get("from")))
        if p and str(e.get("to")) in p["prereqs"]:
            p["prereqs"].remove(str(e.get("to")))
    for e in arr(rep.get("add_prereqs")):
        f, tt = str(e.get("from")), str(e.get("to"))
        p = by_id.get(f)
        if p and tt != f and tt in by_id and tt not in p["prereqs"]:
            p["prereqs"].append(tt)
    drop_cap = max(2, len(points) // 7)
    to_drop = set()
    for d in arr(rep.get("drop_nodes")):
        p = by_id.get(str(d))
        if p and not p["is_goal"] and len(to_drop) < drop_cap:
            to_drop.add(p["id"])
    added = []
    for n in arr(rep.get("add_nodes"))[:5]:
        nid, name = str(n.get("id", "")).strip(), str(n.get("name", "")).strip()
        if not nid or not name or nid in by_id or any(a["id"] == nid for a in added) or nid in to_drop:
            continue
        dom = str(n.get("domain", "B")).strip().upper()
        mid = str(n.get("module", "")).strip()
        added.append({
            "id": nid, "name": name,
            "prereqs": [str(x) for x in arr(n.get("prereqs")) if str(x) in by_id],
            "is_goal": False, "minutes": 30, "domain": dom if dom in valid else "B",
            "desc": str(n.get("desc", "")).strip(), "drill": str(n.get("drill", "")).strip(),
            "benchmark": str(n.get("benchmark", "")).strip(), "module": mid, "module_title": mod_title(mid),
        })
    result = [p for p in points if p["id"] not in to_drop] + added
    live = {p["id"] for p in result}
    for p in result:
        p["prereqs"] = [x for x in p["prereqs"] if x in live and x != p["id"]]
    _break_cycles_raw(result)
    if not any(p["is_goal"] for p in result) and any(p["is_goal"] for p in points):
        spec["points"] = points
        return spec
    if len(result) < min(6, len(points)):
        spec["points"] = points
        return spec
    spec["points"] = result
    return spec


def derive_graph(goal: str, timeout: float = 60.0, lang: str = "", emit=None) -> KnowledgeGraph:
    """层级化倒推：蓝图 → 并行模块展开 → 合并/断环。失败优雅回退到单发倒推。
    emit(dict)：可选进度回调，按真实里程碑吐 search/blueprint/module/assemble/critique 事件（流式用）。"""
    def _emit(ev: dict) -> None:
        if emit:
            try:
                emit(ev)
            except Exception:  # noqa: BLE001 — emit 失败绝不影响倒推
                pass

    key, _, _ = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key。请在 core/.env 设置 TELOS_LLM_API_KEY（见 core/.env.example）。")
    _emit({"t": "phase", "phase": "search"})
    ctx = _derive_context(goal)
    spec = None
    try:
        _emit({"t": "phase", "phase": "blueprint"})
        bp = _blueprint(goal, ctx, lang)
        mods = bp.get("modules") or []
        _emit({
            "t": "blueprint",
            "total": len(mods),
            "modules": [{"id": str(m.get("id", "")), "title": str(m.get("title", ""))} for m in mods],
        })
        expansions = _parallel_expand(goal, bp, lang, emit=_emit)
        if sum(len(v) for v in expansions.values()) >= 6:
            _emit({"t": "phase", "phase": "assemble"})
            cand = _assemble(goal, bp, expansions)
            if len(cand.get("points", [])) >= 6:
                spec = cand
    except Exception:  # noqa: BLE001 — 多段失败回退单发
        spec = None
    if spec is None:
        _emit({"t": "phase", "phase": "single"})
        spec = _derive_single_spec(goal, ctx, lang, timeout)
    try:
        _emit({"t": "phase", "phase": "critique"})
        spec = _critique_and_repair(goal, spec, lang, timeout)
    except Exception:  # noqa: BLE001 — 非破坏：审查异常则保留原图
        pass
    g = _to_graph(spec)
    title = str(spec.get("title", "")).strip()
    if title:
        try:
            g.title = title[:40]
        except Exception:  # noqa: BLE001
            pass
    return g


def _to_graph(spec: dict) -> KnowledgeGraph:
    points = spec.get("points") if isinstance(spec, dict) else None
    if not points:
        raise RuntimeError("LLM 返回缺少 points 字段")
    rows = []
    for p in points:
        pre = p.get("prereqs")
        if pre is None:
            pre = p.get("prerequisites") or []
        try:
            mins = int(p.get("minutes", 25))
        except (TypeError, ValueError):
            mins = 25
        rows.append(
            (
                str(p["id"]),
                str(p.get("name", p["id"])),
                tuple(str(x) for x in pre),
                bool(p.get("is_goal", False)),
                mins,
                str(p.get("domain", "B")),
                str(p.get("desc", "")),
                str(p.get("drill", "")),
                str(p.get("benchmark", "")),
                str(p.get("module", "")),
                str(p.get("module_title", "")),
            )
        )
    return KnowledgeGraph.from_spec(rows)  # validates the DAG + prerequisite existence


# ---- 概括标题：把一句目标压成导航用的简洁主题（给旧项目补标题用，轻量纯文本）----



def summarize_title(goal: str, lang: str = "", timeout: float = 30.0) -> str:
    """把目标概括成简洁主题标题（纯文本，便宜快速）。失败/未配置 → 返回 ''（前端回退到原目标）。"""
    key, base, model = _config()
    if not key:
        return ""
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _TITLE_SYSTEM},
            {"role": "user", "content": _TITLE_USER.format(goal=goal) + _lang_directive(lang)},
        ],
        "temperature": 0.3,
        "stream": False,
        "max_tokens": 40,
        **_thinking_off(model),
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        title = str(data["choices"][0]["message"]["content"]).strip()
    except Exception:  # noqa: BLE001
        return ""
    return title.strip().strip('"').strip("“”「」").splitlines()[0][:40] if title else ""


# ---- 按需微课：讲解 + worked example + 一道检查题（喂回引擎做 teach-verify）----



def _lesson_user(name: str, domain: str, prereqs, goal: str) -> str:
    # LLM 永远推荐资源（含视频公开课）—— 不依赖检索，保证无 Tavily 也有好体验。
    # Tavily（若配置）在 lesson() 里后置增强：把真实直达链接前置到列表，而非替换这些建议。
    pre = "、".join(prereqs) if prereqs else "（无）"
    head = _LESSON_HEADER.format(name=name, domain=domain, prereqs=pre, goal=goal)
    body = _LESSON_STEPS
    body += ' "resources":[{"name":"真实存在、口碑最好的公开课/视频名","platform":"YouTube/B站/Coursera/官方文档"}]\n}\n'
    body += _LESSON_REQS
    body += _STYLE_RULES
    body += (
        "- resources 给 2-3 个真实存在、口碑最好的优质学习资源，**至少包含 1 个视频公开课**"
        "（YouTube/B站/Coursera/中国大学MOOC 等）；只写课程/视频名 + 平台，绝不编造 URL。\n只输出 JSON。"
    )
    return head + body

_MCQ_KINDS = ("predict", "self_explain", "faded", "retrieve")


def _mcq_fields(s: dict):
    options = [str(o) for o in (s.get("options") or []) if str(o).strip()]
    if len(options) < 2:
        return None
    try:
        answer = int(s.get("answer", 0))
    except (TypeError, ValueError):
        answer = 0
    answer = max(0, min(answer, len(options) - 1))
    hints = [str(h).strip() for h in (s.get("hints") or []) if str(h).strip()]
    return options, answer, hints


def _resolve_resources(spec: dict) -> list:
    """规整 LLM 建议的资源为 [{name, platform}]（最多 3 个，去重）。前端无真链时回退平台搜索。"""
    out, seen = [], set()
    for r in (spec.get("resources") or [])[:6]:
        if not isinstance(r, dict):
            continue
        name = str(r.get("name", "")).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        out.append({"name": name, "platform": str(r.get("platform", "")).strip()})
        if len(out) >= 3:
            break
    return out


def _search_resources(topic: str, k: int = 2) -> list:
    """Tavily 命中真实来源 → 真链资源卡（前置到 LLM 建议之前做增强）。未配/出错 → []。"""
    out = []
    for s in web_search(f"{topic} 教程 公开课".strip(), k=4):
        out.append(
            {"name": s["title"][:60], "url": s["url"], "domain": s.get("domain", ""),
             "platform": s.get("domain", ""), "snippet": s.get("snippet", "")}
        )
        if len(out) >= k:
            break
    return out


def _merge_resources(real: list, suggested: list) -> list:
    """真链卡(real)在前 + LLM 建议(suggested)在后，按 url/域名/名称去重，最多 4 个。
    Tavily 是增强：有真链也保留 LLM 的视频公开课建议，二者互补。"""
    out, seen = [], set()
    for r in list(real) + list(suggested):
        dom = (r.get("domain") or "").strip()
        key = (r.get("url") or "").strip() or r.get("name", "")
        if key in seen or (dom and dom in seen):
            continue
        seen.add(key)
        if dom:
            seen.add(dom)
        out.append(r)
        if len(out) >= 4:
            break
    return out


def _validate_lesson(spec: dict) -> dict:
    if not isinstance(spec, dict):
        raise RuntimeError("微课返回格式错误")
    out_steps = []
    for s in spec.get("steps") or []:
        if not isinstance(s, dict):
            continue
        kind = str(s.get("kind", "")).strip()
        if kind == "explain":
            text = str(s.get("text", "")).strip()
            if text:
                out_steps.append({"kind": "explain", "text": text, "analogy": str(s.get("analogy", "")).strip()})
        elif kind == "worked":
            wsteps = []
            for w in s.get("steps") or []:
                if isinstance(w, dict) and str(w.get("do", "")).strip():
                    wsteps.append({"do": str(w["do"]).strip(), "why": str(w.get("why", "")).strip()})
                elif str(w).strip():
                    wsteps.append({"do": str(w).strip(), "why": ""})
            if wsteps:
                out_steps.append({"kind": "worked", "problem": str(s.get("problem", "")).strip(), "steps": wsteps})
        elif kind in _MCQ_KINDS:
            m = _mcq_fields(s)
            if not m:
                continue
            options, answer, hints = m
            q = str(s.get("prompt") or s.get("q") or "").strip()
            if not q:
                continue
            step = {"kind": kind, "prompt": q, "options": options, "answer": answer}
            if kind == "predict":
                step["reveal"] = str(s.get("reveal", "")).strip()
            if kind == "faded":
                step["problem"] = str(s.get("problem", "")).strip()
                step["given"] = [str(g).strip() for g in (s.get("given") or []) if str(g).strip()]
            if kind in ("self_explain", "faded", "retrieve"):
                step["rationale"] = str(s.get("rationale", "")).strip()
            if kind in ("faded", "retrieve"):
                step["hints"] = hints
            out_steps.append(step)
    graded = [st for st in out_steps if st["kind"] in ("retrieve", "faded", "self_explain")]
    if not out_steps or not graded:
        raise RuntimeError("微课内容不完整")
    return {"concept": str(spec.get("concept", "")).strip(), "steps": out_steps, "resources": _resolve_resources(spec)}


def lesson(name: str, domain: str = "B", prereqs=(), goal: str = "", timeout: float = 110.0, lang: str = "") -> dict:
    """生成一个知识点的按需微课（OpenAI 兼容；返回校验过的 dict）。"""
    key, base, model = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key（见 core/.env.example）。")
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _LESSON_SYSTEM},
            {"role": "user", "content": _lesson_user(name, domain, prereqs, goal) + _lang_directive(lang)},
        ],
        "temperature": 0.3,
        "stream": False,
        "response_format": {"type": "json_object"},
        **_thinking_off(model),
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败 HTTP {e.code}（检查 key / base_url / model）") from e
    content = data["choices"][0]["message"]["content"]
    out = _validate_lesson(json.loads(content))
    # Tavily 增强（可选）：把真实直达链接前置到 LLM 建议之前，二者互补；未配则只用 LLM 建议
    topic = (f"{goal} " if goal else "") + name
    real = _search_resources(topic)
    if real:
        out["resources"] = _merge_resources(real, out["resources"])
    return out


# ---- 起点诊断：一次性为一组知识点各生成一道诊断单选题（客观探针）----



def probes(points, goal: str = "", timeout: float = 90.0, lang: str = "") -> dict:
    """一次性为一组知识点各生成一道诊断单选题。points: [{'id','name','domain'}, ...]。"""
    key, base, model = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key（见 core/.env.example）。")
    items = "\n".join(
        f"- {p.get('id')} ｜ {p.get('name', p.get('id'))} ｜ {p.get('domain', 'B')}" for p in points
    )
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _PROBES_SYSTEM},
            {"role": "user", "content": _PROBES_USER.format(goal=goal, items=items) + _derive_context(goal) + _lang_directive(lang)},
        ],
        "temperature": 0.3,
        "stream": False,
        "response_format": {"type": "json_object"},
        **_thinking_off(model),
    }
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"LLM 请求失败 HTTP {e.code}（检查 key / base_url / model）") from e
    spec = json.loads(data["choices"][0]["message"]["content"])
    raw = spec.get("probes") if isinstance(spec, dict) else None
    if not isinstance(raw, dict):
        raise RuntimeError("诊断题返回缺少 probes")
    out: dict = {}
    for pid, q in raw.items():
        if not isinstance(q, dict):
            continue
        options = [str(o) for o in (q.get("options") or []) if str(o).strip()]
        if not str(q.get("q", "")).strip() or len(options) < 2:
            continue
        try:
            ans = int(q.get("answer", 0))
        except (TypeError, ValueError):
            ans = 0
        out[str(pid)] = {
            "q": str(q["q"]).strip(),
            "options": options,
            "answer": max(0, min(ans, len(options) - 1)),
            "rationale": str(q.get("rationale", "")).strip(),
        }
    if not out:
        raise RuntimeError("没有可用的诊断题")
    return {"probes": out}
