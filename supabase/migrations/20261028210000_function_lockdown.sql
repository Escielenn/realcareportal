-- Lock down function execution. Supabase's default privileges grant EXECUTE on new functions to
-- the authenticated role directly, so "revoke from public" alone left internal helpers (renewal job,
-- notify, trigger functions) callable through /rest/v1/rpc. Revoke everything, then grant back only
-- the RPCs the app calls. Each of those checks the caller's role inside the function.
revoke execute on all functions in schema public from authenticated, anon, public;
grant execute on function
  public.is_staff(), public.provider_supports(uuid), public.current_cycle_id(uuid), public.has_course_access(uuid, uuid),
  public.complete_lesson(uuid, text), public.submit_quiz(uuid, int[], text), public.report_video_progress(uuid, numeric, numeric, text),
  public.run_renewals(date), public.renew_provider(uuid), public.submit_form(uuid, jsonb), public.review_submission(uuid, text, jsonb, text),
  public.log_event(text, text, text), public.quiz_for_edit(uuid), public.demo_checkout(uuid), public.grant_access(uuid, uuid, int, text),
  public.refund_order(uuid), public.mark_notifications_read(uuid[]), public.set_my_profile(text, text, boolean),
  public.send_reminders_now(uuid[]), public.open_cycles(uuid[]), public.extend_due(uuid[], date),
  public.staff_mark_complete(uuid, uuid, date, text), public.stage_import(uuid, text, jsonb), public.set_import_match(bigint, uuid),
  public.commit_import(uuid), public.create_form_template(text, text, text, boolean, boolean, jsonb), public.publish_form_version(uuid, jsonb, text),
  public.assign_form(uuid, uuid[], uuid, date, text), public.start_form(uuid, uuid), public.review_document(uuid, text, text)
to authenticated;
grant execute on function public.get_invite(uuid), public.accept_invite(uuid, text), public.submit_application(text, text, text, text, text[], jsonb) to anon, authenticated;
alter default privileges in schema public revoke execute on functions from authenticated, anon, public;

-- Pin search_path on the two helpers the advisor flagged.
alter function public._advance(date, text) set search_path = '';
alter function public._valid_form_schema(jsonb) set search_path = '';
