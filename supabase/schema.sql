-- 《动漫追番日历》M5 匿名云同步 Schema
-- 在 Supabase 项目 SQL Editor 中执行一次即可。
-- 前置：Authentication → Providers → 开启「Allow anonymous sign-ins」。
-- 安全模型：行级安全（RLS），匿名用户与邮箱用户都只能读写 auth.uid() = user_id 的行。

create table if not exists public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,               -- 规范化标题（跨平台合并键）
  title text not null default '',
  platforms jsonb not null default '[]'::jsonb,
  followed_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,          -- 删除墓碑：非空表示已删除（跨设备删除同步）
  primary key (user_id, key)
);

create table if not exists public.blocked (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,               -- 规范化标题
  title text not null default '',
  blocked_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, key)
);

create table if not exists public.settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null default 'global',
  theme text,
  shortfilter_enabled boolean,
  shortfilter_threshold integer,
  ignore_missed jsonb not null default '[]'::jsonb, -- ["key:YYYY-MM-DD", ...] 断更忽略
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, key)
);

create table if not exists public.notify_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  date text not null,              -- YYYY-MM-DD
  show_key text not null,          -- 规范化标题
  notified_at timestamptz not null default now(),
  primary key (user_id, date, show_key)
);

alter table public.follows enable row level security;
alter table public.blocked enable row level security;
alter table public.settings enable row level security;
alter table public.notify_log enable row level security;

create policy "follows_select_own" on public.follows for select using (auth.uid() = user_id);
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = user_id);
create policy "follows_update_own" on public.follows for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = user_id);

create policy "blocked_select_own" on public.blocked for select using (auth.uid() = user_id);
create policy "blocked_insert_own" on public.blocked for insert with check (auth.uid() = user_id);
create policy "blocked_update_own" on public.blocked for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blocked_delete_own" on public.blocked for delete using (auth.uid() = user_id);

create policy "settings_select_own" on public.settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_delete_own" on public.settings for delete using (auth.uid() = user_id);

create policy "notify_log_select_own" on public.notify_log for select using (auth.uid() = user_id);
create policy "notify_log_insert_own" on public.notify_log for insert with check (auth.uid() = user_id);
create policy "notify_log_update_own" on public.notify_log for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notify_log_delete_own" on public.notify_log for delete using (auth.uid() = user_id);
