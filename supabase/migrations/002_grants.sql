-- Run in Supabase Dashboard > SQL Editor (run AFTER 001_init.sql)
--
-- Fixes: "permission denied for table parsed_ideas" (Postgres code 42501).
--
-- RLS (enabled in 001_init.sql) only filters WHICH ROWS are visible once a
-- table is reachable. The `authenticated` role also needs table-level GRANTs
-- to reach the tables at all. We grant to `authenticated` ONLY (not `anon`),
-- because this is a login-only internal tool — the anonymous/publishable key
-- should have no access. RLS policies still govern row access on top of this.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.parsed_ideas,
  public.idea_pages,
  public.idea_page_items,
  public.cws_items
TO authenticated;

-- Make sure tables created later in this schema also grant to authenticated.
-- (Optional convenience; safe to keep.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
