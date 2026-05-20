-- Run in Supabase Dashboard > SQL Editor (run AFTER 001_init.sql)
--
-- Fixes: "permission denied for table parsed_ideas" (Postgres code 42501) when
-- accessing tables with the SECRET key (sb_secret_...), which maps to the
-- `service_role` Postgres role.
--
-- Like 002_grants.sql did for `authenticated`, the `service_role` also needs
-- table-level GRANTs in this project. service_role bypasses RLS, so these grants
-- alone give it full read/write access.
--
-- Used by:
--   - parser/run.ts            (inserts into parsed_ideas)
--   - /api/find-revenue route  (updates cws_items.revenue_found + sources)

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.parsed_ideas,
  public.idea_pages,
  public.idea_page_items,
  public.cws_items
TO service_role;

-- Cover any tables added later in this schema too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
