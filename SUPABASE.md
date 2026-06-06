# 启用云同步（可选）

Telos 默认 **本地优先**：账号/档案存在浏览器里，开箱即用。想让进度跨设备同步，按下面接一个免费的 [Supabase](https://supabase.com) 项目即可——**全程只需你操作，约 2 分钟**（我们不替你创建账号或保存密钥）。

## 步骤

1. 在 supabase.com 新建一个免费项目。
2. 打开 **SQL Editor**，执行：

   ```sql
   create table public.learner_states (
     user_id    uuid not null default auth.uid(),
     profile_id text not null,
     state      jsonb not null,
     updated_at timestamptz not null default now(),
     primary key (user_id, profile_id)
   );
   alter table public.learner_states enable row level security;

   create policy "own rows" on public.learner_states
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```

   > 说明：`on_conflict=profile_id` 的 upsert 需要唯一约束；如需按 profile 维度合并，可改主键或加唯一索引。最小可用版本用 `(user_id, profile_id)` 主键即可。

3. **Authentication → Providers** 打开 Email（Magic Link）。在 **URL Configuration** 把站点 URL 加进 Redirect URLs：`https://yunyueli.github.io/telos/app/account/`。
4. 在 **Project Settings → API** 拿到 `Project URL` 和 `anon` public key。
5. 配置环境变量（部署时注入）：

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   - 本地：写进 `web/.env.local`
   - GitHub Actions：加为 repo 的 **Secrets and variables → Actions → Variables**，并在 `deploy.yml` 的 build step 注入（`env:` 段）。

配置后，「账号」页的云同步区会出现「发送登录链接 / 上传 / 恢复」。未配置时一切照常本地运行。

## 安全

`anon` key 是公开可暴露的（受 RLS 保护）。**切勿**把 `service_role` key 放进前端。真实邮箱只发给 Supabase Auth，不写入 git。
