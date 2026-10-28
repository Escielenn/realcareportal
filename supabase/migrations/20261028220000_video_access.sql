-- Course videos live in the private training-media bucket under courses/<course_id>/.
-- Providers can stream a course's videos only when they have access to that course
-- (free/required, All-Access, or purchased); staff can read everything.
drop policy if exists "training media read" on storage.objects;
create policy "training media read" on storage.objects for select to authenticated using (
  bucket_id = 'training-media' and (
    (select public.is_staff())
    or (
      (storage.foldername(name))[1] = 'courses'
      and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
      and public.has_course_access((select auth.uid()), ((storage.foldername(name))[2])::uuid)
    )
    or (storage.foldername(name))[1] is distinct from 'courses'  -- older uploads made in the course editor
  )
);
