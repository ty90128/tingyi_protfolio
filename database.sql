-- ============================================================
-- database.sql｜個人作品集 CMS
-- 執行位置：Supabase Dashboard > SQL Editor
-- 內容：資料表、索引、觸發器、RLS、Storage Policy、預設選項
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.project_category_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tool_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category_id uuid references public.project_category_options(id) on delete set null,
  subtitle text,
  summary text,
  background text,
  problem text,
  target_users text,
  role text,
  responsibilities text,
  solution text,
  process text,
  result text,
  metrics text,
  reflection text,
  project_date text,
  project_status text not null default '已完成' check (project_status in ('規劃中','進行中','已完成','持續優化','已封存')),
  cover_image_url text,
  cover_alt_text text,
  is_featured boolean not null default false,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  featured_sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null default '其他圖片',
  image_url text not null,
  caption text,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.project_tools (
  project_id uuid not null references public.projects(id) on delete cascade,
  tool_id uuid not null references public.tool_options(id) on delete cascade,
  primary key (project_id, tool_id)
);

create table if not exists public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null default '其他',
  title text not null,
  url text not null check (url ~* '^https?://'),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  organization text not null,
  position text not null,
  start_date text,
  end_date text,
  is_current boolean not null default false,
  location text,
  description text,
  achievements jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.education (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  degree text,
  department text,
  start_date text,
  end_date text,
  is_current boolean not null default false,
  description text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  type text not null default '其他',
  title text not null,
  issuer text,
  issue_date text,
  expiry_date text,
  credential_id text,
  credential_url text,
  image_url text,
  description text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_links (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  value text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 10 and 3000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);

create index if not exists projects_publish_sort_idx on public.projects(is_published, sort_order);
create index if not exists projects_featured_sort_idx on public.projects(is_featured, featured_sort_order);
create index if not exists project_images_project_idx on public.project_images(project_id, category, sort_order);
create index if not exists project_links_project_idx on public.project_links(project_id, sort_order);
create index if not exists contact_messages_created_idx on public.contact_messages(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare t text;
begin
  foreach t in array array['projects','skills','experiences','education','certificates','contact_links']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

insert into public.project_category_options (name, sort_order) values
('產品企劃',1),('網站設計',2),('UI／UX',3),('商業分析',4),('競品分析',5),('學術研究',6),('數位行銷',7),('短影音企劃',8),('創業競賽',9),('資料分析',10),('其他',11)
on conflict (name) do nothing;

insert into public.tool_options (name, sort_order) values
('HTML',1),('CSS',2),('JavaScript',3),('Supabase',4),('GitHub',5),('Vercel',6),('Figma',7),('Canva',8),('Notion',9),('R',10),('Excel',11),('PowerPoint',12),('ChatGPT',13),('Gemini',14),('Claude',15),('Google Analytics',16),('Meta Ads',17),('TikTok',18),('Instagram',19),('LINE OA',20)
on conflict (name) do nothing;

insert into public.site_settings (key, value) values
('site_name','黃婷懌 Portfolio'),
('hero_name','黃婷懌'),
('hero_title','資訊管理研究生／產品企劃／網站與數位內容製作者'),
('hero_tagline','將複雜需求整理成可執行的產品與數位體驗。'),
('hero_description','透過網站規劃、產品企劃與內容製作，將想法轉化為可展示、可管理、可執行的成果。'),
('hero_primary_button_text','查看我的作品'),
('hero_primary_button_url','#projects'),
('hero_primary_button_visible','true'),
('hero_secondary_button_text','聯絡我'),
('hero_secondary_button_url','#contact'),
('hero_secondary_button_visible','true'),
('about_title','關於我'),
('about_subtitle','以需求整理、數位工具與執行能力，完成具體成果。'),
('skills_section_title','核心能力'),
('featured_projects_title','精選作品'),
('projects_section_title','全部作品'),
('experience_section_title','工作／專案經歷'),
('education_section_title','學歷與證照'),
('certificate_section_title','證照與獎項'),
('contact_section_title','聯絡我'),
('contact_section_description','歡迎透過以下方式聯絡合作、實習、工作或專案相關事宜。'),
('footer_text','© 2026 黃婷懌 Portfolio'),
('resume_button_text','下載履歷'),
('seo_title','黃婷懌｜個人作品集'),
('seo_description','黃婷懌的個人作品集，展示網站規劃、產品企劃、數位內容與專案成果。')
on conflict (key) do nothing;

-- 預設聯絡方式；重複執行 SQL 時不會重複新增
insert into public.contact_links (type, title, value, sort_order, is_visible)
select 'Email', 'Email', 'bii19897720011228@gmail.com', 1, true
where not exists (
  select 1 from public.contact_links
  where type = 'Email' and lower(value) = 'bii19897720011228@gmail.com'
);

insert into public.contact_links (type, title, value, sort_order, is_visible)
select 'LINE', 'LINE', 'https://line.me/ti/p/iPlHgOQfLv', 2, true
where not exists (
  select 1 from public.contact_links
  where type = 'LINE' and value = 'https://line.me/ti/p/iPlHgOQfLv'
);

insert into public.contact_links (type, title, value, sort_order, is_visible)
select 'Instagram', 'Instagram｜xav.yi_', 'https://www.instagram.com/xav.yi_/', 3, true
where not exists (
  select 1 from public.contact_links
  where type = 'Instagram' and value = 'https://www.instagram.com/xav.yi_/'
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.project_category_options enable row level security;
alter table public.tool_options enable row level security;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
alter table public.project_tools enable row level security;
alter table public.project_links enable row level security;
alter table public.skills enable row level security;
alter table public.experiences enable row level security;
alter table public.education enable row level security;
alter table public.certificates enable row level security;
alter table public.contact_links enable row level security;
alter table public.contact_messages enable row level security;
alter table public.site_settings enable row level security;

-- 清除同名政策，讓 SQL 可重複執行
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles admin manage" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public active categories" on public.project_category_options for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin categories" on public.project_category_options for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public active tools" on public.tool_options for select to anon, authenticated using (is_active or public.is_admin());
create policy "admin tools" on public.tool_options for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public published projects" on public.projects for select to anon, authenticated using (is_published or public.is_admin());
create policy "admin projects" on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public published project images" on public.project_images for select to anon, authenticated using (exists (select 1 from public.projects p where p.id=project_id and (p.is_published or public.is_admin())));
create policy "admin project images" on public.project_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public published project tools" on public.project_tools for select to anon, authenticated using (exists (select 1 from public.projects p where p.id=project_id and (p.is_published or public.is_admin())));
create policy "admin project tools" on public.project_tools for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public project links" on public.project_links for select to anon, authenticated using (is_visible and exists (select 1 from public.projects p where p.id=project_id and (p.is_published or public.is_admin())));
create policy "admin project links" on public.project_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public visible skills" on public.skills for select to anon, authenticated using (is_visible or public.is_admin());
create policy "admin skills" on public.skills for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public visible experiences" on public.experiences for select to anon, authenticated using (is_visible or public.is_admin());
create policy "admin experiences" on public.experiences for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public visible education" on public.education for select to anon, authenticated using (is_visible or public.is_admin());
create policy "admin education" on public.education for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public visible certificates" on public.certificates for select to anon, authenticated using (is_visible or public.is_admin());
create policy "admin certificates" on public.certificates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public visible contact links" on public.contact_links for select to anon, authenticated using (is_visible or public.is_admin());
create policy "admin contact links" on public.contact_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public submit contact" on public.contact_messages for insert to anon, authenticated with check (true);
create policy "admin contact messages" on public.contact_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admin site settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Storage：請先在 Dashboard 建立 public bucket：portfolio-assets
-- 再執行本段政策。若 bucket 尚未建立，政策仍可建立。
-- ============================================================

drop policy if exists "portfolio public read" on storage.objects;
drop policy if exists "portfolio admin insert" on storage.objects;
drop policy if exists "portfolio admin update" on storage.objects;
drop policy if exists "portfolio admin delete" on storage.objects;

create policy "portfolio public read" on storage.objects for select to anon, authenticated using (bucket_id = 'portfolio-assets');
create policy "portfolio admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio-assets' and public.is_admin());
create policy "portfolio admin update" on storage.objects for update to authenticated using (bucket_id = 'portfolio-assets' and public.is_admin()) with check (bucket_id = 'portfolio-assets' and public.is_admin());
create policy "portfolio admin delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio-assets' and public.is_admin());

-- ============================================================
-- 第一個管理員建立方式
-- 1. 先至 Authentication > Users 建立使用者，或從 admin.html 註冊。
-- 2. 將下方 Email 改成實際管理員 Email，解除註解後執行。
-- ============================================================
-- update public.profiles set is_admin = true where email = '你的管理員信箱@example.com';
