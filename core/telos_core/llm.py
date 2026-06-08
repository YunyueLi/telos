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


_SYSTEM = (
    "你是一位精通刻意练习(deliberate practice)、胜任力框架(EPA/CEFR/ACS)与逆向设计的世界级教练。"
    "给定一个目标，你倒推出达成它真正需要的【可训练能力】——不是知识点清单。"
    "每个能力都可观测、可练习、有量化达标线，并标注前置依赖形成有向无环图(DAG)。只输出 JSON。"
)

_USER = (
    "目标：{goal}\n\n"
    "先判断主导学习类型 domain：A=陈述记忆 / B=良构程序(数学/编程) / C=创造(写作/设计) / "
    "D=动作技能(乐器/运动/手法) / E=开放对抗(竞技体育/电竞/辩论/商战) / F=习惯养成。"
    "然后把目标倒推成 10-16 个【可训练能力节点】，输出严格 JSON：\n"
    '{{"title":"把目标概括成的简洁标题","points":[{{"id":"slug","name":"能做到的事(动宾短语)","prerequisites":["前置id"],"is_goal":false,"minutes":40,"domain":"E",'
    '"desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(具体方法/反馈来源/如何逐步加难)","benchmark":"一个可量化或可观测的达标线(分新手/进阶/精英更好)"}}]}}\n'
    "硬性要求(违反就重写该节点)：\n"
    "0) title：把目标概括成一个简洁的【主题标题】，像课程名，用于导航栏显示——中文≤12字、英文≤4词；"
    "提炼核心主题，绝不照抄整句目标、不要带『我想/学会/达到…水平』这类口语。\n"
    "1) 节点是【能力/可练单元】，不是知识名词。name 用动宾短语(如『把补刀稳定到14分钟120刀』)；"
    "禁止『了解/熟悉/理解X基础/综合能力/心理素质/基础操作』这类泛泛、不可观测的节点。\n"
    "2) 每个节点必须：可观测(能在一段录像/一局/一份作品里看见它发生)、可练习(能设计反复做且渐进加难的 drill)、"
    "有完成标准(benchmark 给量化或行为达标线)。\n"
    "3) 每个节点要能体现『高手与新手在这件事上的差距具体是什么数字/行为』——靠 benchmark 说清。\n"
    "4) 按 domain 调整 drill/benchmark：E 对抗/D 动作→节点是带『动态对手/资源/时间压力』情境的可练技能，"
    "drill 用复盘(VOD)/陪练(scrim)/专项训练，benchmark 用表现数据；C 创造→作品 + rubric 维度；"
    "A/B→应用层能力(在新情境中运用，而非死记)。对抗/创造类至少 1/3 的高层节点考『新局面下的临场决策/迁移』。\n"
    "5) id 为唯一英文 slug；prerequisites 只引用本列表 id 且不成环；由易到难分层；恰有一个 is_goal=true 的终点(目标本身)；"
    "minutes 为预计投入分钟数。只输出 JSON，不要解释。"
)


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


_BLUEPRINT_SYSTEM = (
    "你是精通逆向课程设计(backward design)、胜任力框架(CEFR/Bloom/EPA)与知识空间理论的总架构师。"
    "给定目标，你先判断它的广度，再把它倒推成一份有序的【模块/阶段大纲】(像一门课的章节路线图)，"
    "为后续逐模块展开可训练能力搭好骨架。模块要把这门学习【完整覆盖】、相邻模块递进。只输出 JSON。"
)

_BLUEPRINT_USER_TPL = (
    "目标：__GOAL__\n\n"
    "第一步，判断广度档位 scope 并据此定模块数：\n"
    "- narrow 很窄的单项技能(如『练好CSGO准星拉枪』)→ 3-5 个模块、每模块 4-6 个能力\n"
    "- skill 一项成形技能/一个单元(如『入门React』『人像布光』)→ 5-7 个模块、每模块 6-8 个\n"
    "- course 一门课/较完整能力(如『半马完赛』『写出可发表短篇』)→ 6-8 个模块、每模块 7-9 个\n"
    "- subject 一门学科/大领域(如『掌握机器学习』『精通哈利波特研究』)→ 7-9 个模块、每模块 8-10 个\n\n"
    "第二步，把目标倒推成有序模块(由基础到综合)，并给出终点目标节点。严格输出 JSON：\n"
    '{"title":"简洁主题标题(导航用,中文≤12字/英文≤4词,提炼核心、不照抄整句)",'
    '"domain":"主导学习类型A-F(A陈述记忆/B良构程序/C创造/D动作/E对抗/F习惯)",'
    '"scope":"narrow|skill|course|subject",'
    '"modules":[{"id":"英文slug","title":"模块名(名词短语)","summary":"这个模块覆盖什么(一句话)","target":本模块能力数,"order":1}],'
    '"goal":{"id":"英文slug","name":"终点能力(动宾短语,即目标本身)","domain":"E","desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么综合演练","benchmark":"量化达标线(分新手/进阶/精英)","module":"它所属的最后一个模块id"}}\n'
    "要求：1)模块数与 target 按 scope 选，总能力数 ~15(窄)到 ~75(学科)；"
    "2)模块覆盖完整(基础/核心/进阶/综合/实战等关键阶段不缺)、相邻递进；"
    "3)模块是『阶段/主题』而非单个能力；goal 是整门学习的综合产出(像 EPA：能独立完成的真实任务)；"
    "4)id 唯一英文 slug。只输出 JSON。"
)

_MODULE_SYSTEM = (
    "你是精通刻意练习(deliberate practice)与胜任力分解的世界级教练。给定一门学习的某个模块，"
    "你把它展开成若干【可训练能力节点】——每个都可观测、可反复练习且能渐进加难、有量化达标线，"
    "是『能做到的事』而不是知识名词。只输出 JSON。"
)

_MODULE_USER_TPL = (
    "总目标：__GOAL__\n"
    "这门学习的全部模块(顺序)：__MODLIST__\n"
    "终点产出：__GOALNAME__\n\n"
    "现在只展开这一个模块：【__MID__】__MTITLE__ —— __MSUM__\n"
    "把它展开成约 __TARGET__ 个可训练能力节点，严格输出 JSON：\n"
    '{"nodes":[{"id":"模块内唯一英文slug","name":"能做到的事(动宾短语,用Bloom动词)","domain":"A-F","minutes":40,"desc":"can-do：在什么条件下能做到什么、到什么标准","drill":"怎么刻意练习(方法/反馈来源/如何加难)","benchmark":"量化或可观测达标线(分新手/进阶/精英更好)","prereq_ids":["本模块内更基础节点的id"],"prereq_hints":["需要先掌握但属于其它模块的能力(用自然语言短语,不要编id)"]}]}\n'
    "硬性要求：1)节点是能力/可练单元，name 用动宾短语(如『把补刀稳定到14分钟120刀』)；"
    "禁止『了解/熟悉/理解X基础/综合能力/心理素质』这类不可观测的词。"
    "2)每个节点可观测、能设计反复且渐进加难的 drill、benchmark 给量化或行为达标线(体现高手与新手差距)。"
    "3)按 domain 调整：E对抗/D动作→带动态对手/时间压力的情境技能、drill用复盘(VOD)/陪练、benchmark用表现数据；"
    "C创造→作品+rubric维度；A/B→在新情境中运用而非死记。"
    "4)prereq_ids 只引用本模块内 id；跨模块前置写进 prereq_hints(自然语言)。由易到难。只输出 JSON。"
)


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


def _parallel_expand(goal: str, bp: dict, lang: str) -> dict:
    mods = bp["modules"]
    out: dict = {}
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(mods)))) as ex:
        futs = {ex.submit(_expand_module, goal, bp, m, lang): m["id"] for m in mods}
        for fut in as_completed(futs):
            mid = futs[fut]
            try:
                out[mid] = fut.result()
            except Exception:  # noqa: BLE001 — 单模块失败不拖垮整体
                out[mid] = []
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


def derive_graph(goal: str, timeout: float = 60.0, lang: str = "") -> KnowledgeGraph:
    """层级化倒推：蓝图 → 并行模块展开 → 合并/断环。失败优雅回退到单发倒推。"""
    key, _, _ = _config()
    if not key:
        raise RuntimeError("未配置 LLM API key。请在 core/.env 设置 TELOS_LLM_API_KEY（见 core/.env.example）。")
    ctx = _derive_context(goal)
    spec = None
    try:
        bp = _blueprint(goal, ctx, lang)
        expansions = _parallel_expand(goal, bp, lang)
        if sum(len(v) for v in expansions.values()) >= 6:
            cand = _assemble(goal, bp, expansions)
            if len(cand.get("points", [])) >= 6:
                spec = cand
    except Exception:  # noqa: BLE001 — 多段失败回退单发
        spec = None
    if spec is None:
        spec = _derive_single_spec(goal, ctx, lang, timeout)
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

_TITLE_SYSTEM = "你把学习目标概括成一个简洁的【主题标题】，像课程名。只输出标题本身，不要引号、不要标点结尾、不要解释。"
_TITLE_USER = (
    "把下面的学习目标概括成一个简洁标题：中文≤12字、英文≤4词；提炼核心主题，"
    "去掉『我想/学会/达到…水平』这类口语。只输出标题。\n目标：{goal}"
)


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

_LESSON_SYSTEM = (
    "你是一位精通认知科学的微课设计师。针对单个知识点，设计一节【交互式、能真正学会】的微课——"
    "靠『让学习者动手、预测、补全、检索』来建构理解，而不是堆砌讲解文字。"
    "遵循证据：预测先行 → 直觉讲解 → 分步范例 → 自我解释 → 渐隐填空(worked-example fading) → 无脚手架检索(掌握闸门)；"
    "答错时给【提示阶梯】，逐步逼近但绝不直接给答案。只输出 JSON。"
)

# header 带占位符（.format 注入）；body 含 JSON 模板，保持原始花括号，不走 .format。
_LESSON_HEADER = (
    "知识点：{name}\n所属目标：{goal}\n学习类型(domain)：{domain}\n学习者已掌握的前置：{prereqs}\n\n"
)
# 步骤模板（concept + 6 步），结尾停在 steps 数组之后，便于拼接两种 resources 指令。
_LESSON_STEPS = (
    "设计一节交互式微课，严格输出如下 JSON（steps 必须正好按此 6 步顺序、kind 用英文小写）：\n"
    '{\n'
    ' "concept":"一句话点出这个知识点的核心要义 / 高手的关键认知",\n'
    ' "steps":[\n'
    '  {"kind":"predict","prompt":"讲解前先抛出的核心问题，让学习者先猜（低风险、不计分）","options":["..4 项.."],"answer":0,"reveal":"揭示正确项并一句话点出为何，自然引出讲解"},\n'
    '  {"kind":"explain","text":"≤160 字、建立直觉的讲解，点出高手与新手的关键差别，不要只给定义","analogy":"用学习者已掌握的前置打一个贴切类比（无前置则用生活常识）"},\n'
    '  {"kind":"worked","problem":"一个带具体情境/数字、能照着做一遍的真实范例","steps":[{"do":"这一步做什么","why":"为什么/关键点"}]},\n'
    '  {"kind":"self_explain","prompt":"针对上面范例的某一步问『为什么这样做/为何成立』","options":["..4 项.."],"answer":0,"rationale":"为什么对"},\n'
    '  {"kind":"faded","problem":"与范例同类型的新题","given":["已替学习者写好的前几步（文字）"],"prompt":"最后一步该怎么做？","options":["..4 项.."],"answer":0,"hints":["提示1：方向","提示2：更具体","提示3：几乎点破但不给答案"],"rationale":"为什么"},\n'
    '  {"kind":"retrieve","prompt":"一道全新的、无任何脚手架的应用/情境判断题（掌握闸门）","options":["..4 项.."],"answer":0,"hints":["提示1","提示2"],"rationale":"为什么对、其它为何错"}\n'
    ' ],\n'
)
_LESSON_REQS = (
    "硬性要求：\n"
    "- 每道选择题恰 4 个选项，answer 为正确项下标(0-3)，唯一正确；错项要对应进阶者真实会犯的误解，禁止送分题。\n"
    "- worked.steps 给 3-5 步，每步含 do+why，能照着做一遍。\n"
    "- faded 是『完成式问题』：given 写好前几步、把最后一步留空让学习者补；hints 是【提示阶梯】2-3 条，由浅入深、最后一条几乎点破但仍不直接给答案。\n"
    "- retrieve 是无脚手架的迁移题，作为掌握闸门。\n"
    "- 按 domain 调整：A 记忆=例子/助记；B 程序=可分步范例；C 创造=范例+rubric 要点；D 动作=分解练习+达标反馈；E 对抗=情境拆解+决策；F 习惯=触发-行为-奖励设计。\n"
)


def _lesson_user(name: str, domain: str, prereqs, goal: str) -> str:
    # LLM 永远推荐资源（含视频公开课）—— 不依赖检索，保证无 Tavily 也有好体验。
    # Tavily（若配置）在 lesson() 里后置增强：把真实直达链接前置到列表，而非替换这些建议。
    pre = "、".join(prereqs) if prereqs else "（无）"
    head = _LESSON_HEADER.format(name=name, domain=domain, prereqs=pre, goal=goal)
    body = _LESSON_STEPS
    body += ' "resources":[{"name":"真实存在、口碑最好的公开课/视频名","platform":"YouTube/B站/Coursera/官方文档"}]\n}\n'
    body += _LESSON_REQS
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

_PROBES_SYSTEM = (
    "你是一位顶尖的测评专家。你出的诊断题考【应用/分析/决策】而非记忆，"
    "每个错误选项都对应一种真实存在的高水平误解——有似是而非错误心智模型的进阶者会被带偏，真专家不会。只输出 JSON。"
)

_PROBES_USER = (
    "目标：{goal}\n知识点列表(id ｜ 名称 ｜ 类型)：\n{items}\n\n"
    "为每个 id 出一道有区分度的诊断题，输出严格 JSON：\n"
    '{{"probes":{{"<id>":{{"q":"题干","options":["A","B","C","D"],"answer":0,"rationale":"为何对，及每个错项对应哪种误解"}}}}}}\n'
    "硬性要求：\n"
    "1) 禁止送分题：不要『X最需要什么/最重要的是』这类有明显安全答案的题，不要纯背定义。\n"
    "2) 考高阶(应用/分析/评价)：给一个具体情境或案例，问最优判断 / 下一步该做什么 / 为什么。\n"
    "3) 对抗(E)/动作(D)类出【情境判断题】：描述一个真实局面(含对手/资源/时间压力)，在 4 个看似都合理的行动里选最优。\n"
    "4) 每个错误选项必须对应一种【真实的高水平误解】(如『过度求稳放弃节奏』『只看自家数据忽视全局』『无脑服从指令而不做风险评估』)，"
    "使持错误心智模型的进阶者被带偏、真专家会避开；不要编明显荒谬的错项。\n"
    "5) 恰 4 个选项、answer 为正确项下标(0-3)、唯一正确答案；键必须用给定 id。只输出 JSON。"
)


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
