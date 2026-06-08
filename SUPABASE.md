# 账号与跨设备同步（可选）

Telos 默认 **本地优先**：不登录也能用，数据存在浏览器里。接一个**免费 [Supabase](https://supabase.com)** 项目即可开启**账号登录 + 跨设备同步**——支持「邮箱+密码 / 魔法链接 / Google·GitHub 一键登录」。**全程只需你操作，约 5 分钟；我们不替你创建账号、不保存任何密钥。**

未配置时一切照常本地运行；配置后「设置 → 云同步」与 `/account` 页会出现登录与同步。

---

## 1. 新建项目

在 [supabase.com](https://supabase.com) 新建一个免费项目（记住数据库区域即可）。

## 2. 建同步表（SQL Editor 执行）

按「每个学习项目一行」存储，受 RLS 保护，仅本人可读写：

```sql
create table public.projects (
  user_id    uuid        not null default auth.uid(),
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.projects enable row level security;

create policy "own rows" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

> 合并策略：客户端按 `data.updatedAt` 做 per-project 最后写入者胜（两台设备改不同项目都不丢）。

### 2b. 周排行榜表（可选 · 「坚持」Tab 多人周联赛用，暂未接客户端）

启用全局周榜后才需要建；不建也不影响其它功能（坚持 Tab 的段位天梯/成就/连胜全是本地的）。

```sql
create table public.leaderboard (
  user_id    uuid        references auth.users primary key,
  name       text,
  week       text        not null,   -- ISO 周，如 2026-W24（周一 GMT 滚动）
  xp         int         not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;
create policy "read all"   on public.leaderboard for select using (true);
create policy "write own"  on public.leaderboard for insert with check (auth.uid() = user_id);
create policy "update own" on public.leaderboard for update using (auth.uid() = user_id);
```

> 全局周榜（按本周 XP 排名）而非 30 人分组联赛（后者需 cron 分 cohort）。客户端接入计划见 `docs/HANDOFF.md` §7。

## 3. 配置登录方式（Authentication → Providers / URL Configuration）

- **Email**：默认开启，即同时支持「邮箱+密码」和「魔法链接（OTP）」。如需关闭注册邮件确认可在 Email 设置里调整（保持开启更安全）。
- **Google**：在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建 OAuth 客户端，授权回调填 `https://<项目ref>.supabase.co/auth/v1/callback`，把 Client ID/Secret 填进 Supabase 的 Google provider。
- **GitHub**：在 GitHub → Settings → Developer settings → OAuth Apps 新建，Authorization callback URL 同样填 `https://<项目ref>.supabase.co/auth/v1/callback`，把 Client ID/Secret 填进 Supabase 的 GitHub provider。
- **URL Configuration → Redirect URLs** 加入这两个（OAuth / 魔法链接 / 邮件确认都会回跳到 `/account/`）：
  ```
  http://localhost:3000/account/
  https://yunyueli.github.io/telos/app/account/
  ```
  Site URL 可设为 `https://yunyueli.github.io/telos/app/`。

> 只想要账密 + 魔法链接、暂不接 OAuth？跳过 Google/GitHub 即可，登录页的对应按钮点了会提示未启用，不影响其余功能。

## 4. 拿到 URL 和 anon key

**Project Settings → API**：复制 `Project URL` 和 `anon` `public` key。

## 5. 注入环境变量

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

- **本地**：写进 `web/.env.local`（已被 gitignore），重启 `./start.sh`。
- **线上（GitHub Pages）**：repo → **Settings → Secrets and variables → Actions → Variables** 添加同名两项。`deploy.yml` 的 build step 已接好注入，推一次即生效。

完成后：`/account` 出现登录 / 注册；登录后本机项目自动合并上云，其它设备登录同账号即自动拉取。

---

## 安全

- `anon` key 是**公开可暴露**的（受 RLS 保护），可以放进前端 / repo Variables。
- **切勿**把 `service_role` key 放进前端或仓库。
- 真实邮箱/密码只交给 Supabase Auth（加盐哈希、绝不存明文），不写入 git。
