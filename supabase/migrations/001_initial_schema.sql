-- ============================================================
-- Elysia · Initial Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ─── profiles ────────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  name        text,
  date_of_birth date,
  height_cm   numeric,
  weight_kg   numeric,
  goals       text[] default array[]::text[],
  wearables   text[] default array[]::text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── habits ──────────────────────────────────────────────────
create table public.habits (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references auth.users on delete cascade not null,
  template_id         text,
  title               text not null,
  category            text not null,
  expected_benefit    text not null default '',
  state               text not null default 'active',
  schedule            jsonb not null,
  reminder_rule       jsonb,
  streak_count        integer default 0,
  completion_rate_30d numeric default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─── habit_completions ───────────────────────────────────────
create table public.habit_completions (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users on delete cascade not null,
  habit_id       uuid references public.habits on delete cascade not null,
  completed_date date not null default current_date,
  completed_at   timestamptz default now(),
  unique(habit_id, completed_date)
);

-- ─── nutrition_goals ─────────────────────────────────────────
create table public.nutrition_goals (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references auth.users on delete cascade not null unique,
  goal_type         text not null,
  weekly_change_kg  numeric default 0.5,
  activity_level    text not null,
  dietary_approach  text not null,
  calorie_target    integer,
  protein_g         integer,
  carbs_g           integer,
  fat_g             integer,
  tdee              integer,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─── food_log ────────────────────────────────────────────────
create table public.food_log (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  name         text not null,
  brand        text,
  meal_type    text not null,
  calories     numeric not null,
  protein_g    numeric default 0,
  carbs_g      numeric default 0,
  fat_g        numeric default 0,
  quantity     numeric not null,
  unit         text not null,
  barcode      text,
  logged_date  date not null default current_date,
  logged_at    timestamptz default now()
);

-- ─── weight_log ──────────────────────────────────────────────
create table public.weight_log (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  weight_kg    numeric not null,
  logged_date  date not null default current_date,
  logged_at    timestamptz default now(),
  unique(user_id, logged_date)
);

-- ─── wearable_connections ────────────────────────────────────
create table public.wearable_connections (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users on delete cascade not null,
  provider       text not null,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  is_active      boolean default true,
  last_synced_at timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(user_id, provider)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles            enable row level security;
alter table public.habits              enable row level security;
alter table public.habit_completions   enable row level security;
alter table public.nutrition_goals     enable row level security;
alter table public.food_log            enable row level security;
alter table public.weight_log          enable row level security;
alter table public.wearable_connections enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- habits
create policy "habits_select" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update" on public.habits for update using (auth.uid() = user_id);
create policy "habits_delete" on public.habits for delete using (auth.uid() = user_id);

-- habit_completions
create policy "completions_select" on public.habit_completions for select using (auth.uid() = user_id);
create policy "completions_insert" on public.habit_completions for insert with check (auth.uid() = user_id);
create policy "completions_delete" on public.habit_completions for delete using (auth.uid() = user_id);

-- nutrition_goals
create policy "nutrition_goals_all" on public.nutrition_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- food_log
create policy "food_log_select" on public.food_log for select using (auth.uid() = user_id);
create policy "food_log_insert" on public.food_log for insert with check (auth.uid() = user_id);
create policy "food_log_delete" on public.food_log for delete using (auth.uid() = user_id);

-- weight_log
create policy "weight_log_all" on public.weight_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- wearable_connections
create policy "wearables_all" on public.wearable_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
