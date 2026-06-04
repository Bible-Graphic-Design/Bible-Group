-- ========== Bible Group · 建表 ==========
-- 在 Supabase 项目 SQL Editor 中执行一次即可

create table if not exists public.assets (
  id text primary key,
  filename text not null,
  original_name text not null,
  mime text not null,
  size bigint not null,
  url text not null,
  created_at bigint not null
);

create table if not exists public.tasks (
  id text primary key,
  zone_id text not null,
  asset_id text not null,
  model text not null,
  ratio text not null,
  quality text not null,
  mode_id text not null,
  extra_prompt text,
  styles jsonb default '[]'::jsonb,
  font jsonb default '{}'::jsonb,
  letter text,
  seed integer,
  status text not null,
  error_message text,
  output_url text,
  winner boolean default false,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists idx_tasks_zone_id on public.tasks(zone_id);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create index if not exists idx_assets_created_at on public.assets(created_at desc);

-- ========== 同时记得在 Storage 里建一个 public bucket: uploads ==========
