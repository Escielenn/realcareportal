-- Remove the temporary helpers used once to bring Gravity Forms definition exports (no PHI) into the repo.
drop function if exists public._file_get(text);
drop function if exists public._file_drop(text, text);
drop table if exists demo.file_drop;
