-- Client records (Nov 10, 2026, Jason): clients (people supported) become a full record that forms, providers and Real Care
-- staff attach to. Clients never sign in; the record is a sorting and indexing element, not an account.
-- Everything here is client information, so it stays behind the client-features switch and the HIPAA step in production.

-------------------------------------------------------------------------------- client details
alter table public.individuals add column if not exists client_number text;         -- Real Care's own reference, not a Medicaid ID
alter table public.individuals add column if not exists preferred_name text;
alter table public.individuals add column if not exists status text not null default 'active'
  check (status in ('prospective', 'active', 'on_hold', 'discharged'));
alter table public.individuals add column if not exists program text;               -- e.g. HCBS-DD, SLS, CES, Host Home
alter table public.individuals add column if not exists county text;
alter table public.individuals add column if not exists residence_type text;        -- host home, family home, own home
alter table public.individuals add column if not exists primary_language text not null default 'en' check (primary_language in ('en', 'es', 'other'));
alter table public.individuals add column if not exists service_start date;
alter table public.individuals add column if not exists service_end date;
alter table public.individuals add column if not exists case_management_agency text;
alter table public.individuals add column if not exists case_manager_name text;
alter table public.individuals add column if not exists case_manager_phone text;
alter table public.individuals add column if not exists case_manager_email text;
alter table public.individuals add column if not exists updated_at timestamptz not null default now();
create unique index if not exists individuals_client_number on public.individuals (client_number) where client_number is not null;
create index if not exists individuals_status on public.individuals (status, full_name);
drop trigger if exists touch on public.individuals;
create trigger touch before update on public.individuals for each row execute function public.touch_updated_at();

-- Keep the older active flag in step with status (receiving services = active or on hold).
create or replace function public.trg_individual_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.active := new.status in ('active', 'on_hold');
  return new;
end $$;
drop trigger if exists individual_status on public.individuals;
create trigger individual_status before insert or update of status on public.individuals for each row execute function public.trg_individual_status();
update public.individuals set status = case when active then 'active' else 'discharged' end;

-------------------------------------------------------------------------------- provider relationships
alter table public.provider_individuals add column if not exists relationship text not null default 'primary'
  check (relationship in ('primary', 'respite', 'temporary', 'prospective'));
alter table public.provider_individuals add column if not exists note text check (length(note) <= 500);

-- A prospective provider (meet and greet stage) doesn't see the client's forms or documents yet.
create or replace function public.provider_supports(p_individual uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.provider_individuals pi
    where pi.provider_id = auth.uid() and pi.individual_id = p_individual and pi.relationship <> 'prospective'
      and pi.starts_on <= current_date and (pi.ends_on is null or pi.ends_on >= current_date));
$$;
comment on function public.provider_supports(uuid) is 'Security definer: true only while the caller has a current, non-prospective link to the client.';

-------------------------------------------------------------------------------- Real Care staff assigned to a client
create table public.individual_staff (
  individual_id uuid not null references public.individuals(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'coordinator' check (role in ('coordinator', 'nurse', 'supervisor', 'other')),
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now(),
  primary key (individual_id, staff_id, role)
);
create index on public.individual_staff (staff_id);
create trigger audit after insert or update or delete on public.individual_staff for each row execute function public.audit_trigger();
alter table public.individual_staff enable row level security;
create policy "staff read" on public.individual_staff for select to authenticated using ((select public.is_staff()));
create policy "staff insert" on public.individual_staff for insert to authenticated with check ((select public.is_staff())
  and exists (select 1 from public.profiles p where p.id = staff_id and p.role in ('staff', 'admin')));
create policy "staff update" on public.individual_staff for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
-- No delete: ending an assignment sets ends_on, so the history stays.

-------------------------------------------------------------------------------- faster lookups by client
create index if not exists assignments_individual_due on public.assignments (individual_id, due_on desc);
create index if not exists documents_individual on public.documents (individual_id);
