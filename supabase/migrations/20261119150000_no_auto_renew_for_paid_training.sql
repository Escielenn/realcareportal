-- Paid training never renews or charges again on its own (Real Care request, Nov 16, 2026).
-- A purchase gives access for its term. When the term ends, access ends; the provider buys again when they need it.
-- Free programs (paid by Real Care) can still renew automatically, because no one is charged.
-- See docs/decisions/0004-no-auto-renew-for-paid-training.md.

-- 1. Turn off any automatic renewal already saved on a paid program. History stays in audit_log via the trigger.
update public.program_auto_renew ar
set auto_renew = false
from public.programs pr
where pr.id = ar.program_id and pr.price_cents > 0 and ar.auto_renew;

-- 2. The provider switch only works on free programs.
create or replace function public.set_auto_renew(p_program uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.entitlements e where e.provider_id = auth.uid() and e.program_id = p_program) then
    raise exception 'Join the program first.';
  end if;
  if coalesce(p_on, false) and exists (select 1 from public.programs pr where pr.id = p_program and pr.price_cents > 0) then
    raise exception 'Paid training does not renew automatically. Buy it again when your access ends.';
  end if;
  insert into public.program_auto_renew (provider_id, program_id, auto_renew) values (auth.uid(), p_program, coalesce(p_on, false))
  on conflict (provider_id, program_id) do update set auto_renew = excluded.auto_renew;
end $$;

-- 3. Nightly job: free programs only. Paid programs are never renewed or charged here, in demo mode or production,
--    and no Stripe subscription is to be created for them (one-time Checkout payments only).
create or replace function public._program_autorenew(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record;
begin
  for r in
    select ar.provider_id, pr.id as program_id, pr.duration_days, max(e.ends_on) as ends_on
    from public.program_auto_renew ar
    join public.programs pr on pr.id = ar.program_id and pr.active and pr.price_cents = 0
    join public.profiles pf on pf.id = ar.provider_id and pf.active
    join public.entitlements e on e.provider_id = ar.provider_id and e.program_id = ar.program_id
    where ar.auto_renew
    group by ar.provider_id, pr.id, pr.duration_days
    having max(e.ends_on) between p_as_of and p_as_of + 3
  loop
    perform public._join_program(r.provider_id, r.program_id, 'paid_by_real_care', 0, r.duration_days, 'Automatic renewal', null);
    perform public.notify(r.provider_id, 'program_renewed', '/programs', 'program_renewed:' || r.provider_id || ':' || r.program_id || ':' || r.ends_on);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Same grants as before: providers may flip their own switch; only the scheduler runs the job.
revoke execute on function public._program_autorenew(date) from public, anon, authenticated;
grant execute on function public.set_auto_renew(uuid, boolean) to authenticated;
