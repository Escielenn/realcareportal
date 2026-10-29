-- Supabase security advisor (Oct 28, 2026): new functions picked up EXECUTE for anon through default privileges.
-- Signed-out visitors may call only the sign-in, invite, password-help and application functions below.
-- Everything else is revoked from anon. All remaining functions check the caller inside (auth.uid(), is_staff()).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    if f.proname in ('accept_invite', 'get_invite', 'get_password_reset', 'use_password_reset', 'request_password_help', 'submit_application', 'log_failed_sign_in') then
      execute format('grant execute on function %s to anon', f.sig);
    else
      execute format('revoke execute on function %s from anon, public', f.sig);
    end if;
  end loop;
end $$;
