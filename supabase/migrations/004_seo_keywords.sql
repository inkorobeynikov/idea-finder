-- Run in Supabase Dashboard > SQL Editor
-- SEO Keywords research: a startup URL on each idea page, a set of research URLs,
-- and the keyword results scraped from SEMrush Keyword Magic (Broad Match).
-- Idempotent on the columns/tables (IF NOT EXISTS); policies follow 001_init.sql.

-- Startup URL stored on the idea page itself
ALTER TABLE idea_pages ADD COLUMN IF NOT EXISTS startup_url text;

-- Keyword research results per idea page
CREATE TABLE IF NOT EXISTS seo_keywords (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_page_id  uuid REFERENCES idea_pages ON DELETE CASCADE,
  keyword       text NOT NULL,
  global_volume int  NOT NULL,
  kd            int  NOT NULL,
  researched_at timestamptz DEFAULT now()
);
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON seo_keywords FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Extra manually-added research URLs (beyond startup_url and cws_items)
CREATE TABLE IF NOT EXISTS seo_research_urls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_page_id  uuid REFERENCES idea_pages ON DELETE CASCADE,
  url           text NOT NULL,
  label         text
);
ALTER TABLE seo_research_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all" ON seo_research_urls FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Table-level grants, consistent with 002_grants.sql / 003_service_role_grants.sql.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.seo_keywords,
  public.seo_research_urls
TO authenticated, service_role;
