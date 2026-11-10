create extension if not exists pgcrypto with schema extensions;

-- PEOPLE
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'provider' check (role in ('provider','staff','admin')),
  full_name text not null,
  email text not null,
  phone text,
  locale text not null default 'en' check (locale in ('en','es')),
  provider_types text[] not null default '{}',
  hire_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.individuals (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_of_birth date,
  goals jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.provider_individuals (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  individual_id uuid not null references public.individuals(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  primary key (provider_id, individual_id)
);

-- TRAINING
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_en text not null,
  title_es text not null,
  description_en text not null default '',
  description_es text not null default '',
  sort int not null default 0,
  is_specialty boolean not null default false,
  price_cents int not null default 1000
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  sort int not null,
  kind text not null check (kind in ('reading','video','quiz')),
  title_en text not null,
  title_es text not null,
  body_en text not null default '',
  body_es text not null default '',
  pass_percent int not null default 80
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  sort int not null,
  prompt_en text not null,
  prompt_es text not null,
  options_en jsonb not null,
  options_es jsonb not null,
  correct int not null,
  explanation_en text not null default '',
  explanation_es text not null default ''
);

create table public.requirements (
  provider_type text not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  frequency text not null default 'annual' check (frequency in ('annual','once')),
  primary key (provider_type, course_id)
);

create table public.training_cycles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  cycle_number int not null,
  starts_on date not null,
  due_on date not null,
  label text,
  created_at timestamptz not null default now(),
  unique (provider_id, cycle_number)
);

create table public.lesson_progress (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  cycle_id uuid not null references public.training_cycles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (provider_id, lesson_id, cycle_id)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  cycle_id uuid not null references public.training_cycles(id) on delete cascade,
  score int not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  cycle_id uuid not null references public.training_cycles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  language text not null default 'en',
  score int,
  source text not null default 'portal' check (source in ('portal','legacy_wix','staff_override')),
  unique (provider_id, course_id, cycle_id)
);

-- FORMS
create table public.form_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_en text not null,
  title_es text not null,
  schema jsonb not null,
  per_individual boolean not null default true,
  version int not null default 1
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.form_templates(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  individual_id uuid references public.individuals(id) on delete cascade,
  due_on date not null,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}',
  status text not null default 'submitted' check (status in ('submitted','returned','accepted')),
  flags jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create table public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  actor uuid references public.profiles(id),
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

-- COMMUNICATION
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_en text not null,
  title_es text not null,
  body_en text not null,
  body_es text not null,
  audience text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- AUDIT
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb not null default '{}',
  at timestamptz not null default now()
);

create index on public.completions (provider_id, cycle_id);
create index on public.training_cycles (provider_id, starts_on desc);
create index on public.assignments (provider_id);
create index on public.submissions (status);
create index on public.messages (provider_id, created_at);
create index on public.lessons (course_id, sort);
create index on public.quiz_questions (lesson_id, sort);
create index on public.audit_log (at desc);
