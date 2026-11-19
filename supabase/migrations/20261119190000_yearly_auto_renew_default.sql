-- Program members renew yearly by default (Jason's decision for Real Care, Nov 19, 2026).
-- Real Care wants paying and free members to continue "without us having to do anything".
-- Providers can still turn automatic renewal off on the Programs page, and they get notice before a paid renewal.
-- See docs/decisions/0004-yearly-auto-renew-by-default.md.

-- 1. Joining a program (bought, given by staff, renewed or carried over from Wix) turns automatic renewal on,
--    unless the provider already made a choice for that program. A choice to turn it off is never overwritten.
create or replace function public._default_auto_renew() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.program_id is not null then
    insert into public.program_auto_renew (provider_id, program_id, auto_renew)
    values (new.provider_id, new.program_id, true)
    on conflict (provider_id, program_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public._default_auto_renew() from public, anon, authenticated;

drop trigger if exists default_auto_renew on public.entitlements;
create trigger default_auto_renew after insert on public.entitlements
for each row execute function public._default_auto_renew();

-- 2. Current members with no saved choice get the same default.
insert into public.program_auto_renew (provider_id, program_id, auto_renew)
select distinct e.provider_id, e.program_id, true
from public.entitlements e
where e.program_id is not null
on conflict (provider_id, program_id) do nothing;

-- 3. Notice before a renewal: 30 days and 7 days ahead (was 7 days only), so a yearly charge is never a surprise.
create or replace function public._program_reminders(p_as_of date) returns int
language plpgsql security definer set search_path = '' as $$
declare v_count int := 0; r record; v_days int;
begin
  for r in
    select distinct on (e.provider_id, e.program_id) e.* from public.entitlements e
    join public.programs pr on pr.id = e.program_id
    where e.program_id is not null and e.starts_on <= p_as_of
    order by e.provider_id, e.program_id, e.ends_on desc
  loop
    v_days := r.ends_on - p_as_of;
    if exists (select 1 from public.program_auto_renew ar join public.programs pr on pr.id = ar.program_id and pr.active
               where ar.provider_id = r.provider_id and ar.program_id = r.program_id and ar.auto_renew) and v_days >= 0 then
      if v_days = 7 then
        perform public.notify(r.provider_id, 'program_autorenew_soon', '/programs', 'program_autorenew_soon:' || r.id, v_days);
        v_count := v_count + 1;
      elsif v_days = 30 then
        perform public.notify(r.provider_id, 'program_autorenew_soon', '/programs', 'program_autorenew_soon:' || r.id || ':30', v_days);
        v_count := v_count + 1;
      end if;
    elsif v_days in (30, 7) then
      perform public.notify(r.provider_id, 'program_ending', '/programs', 'program_ending:' || r.id || ':' || v_days, v_days);
      v_count := v_count + 1;
    elsif v_days = -1 then
      perform public.notify(r.provider_id, 'program_ended', '/programs', 'program_ended:' || r.id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;
revoke execute on function public._program_reminders(date) from public, anon, authenticated;
