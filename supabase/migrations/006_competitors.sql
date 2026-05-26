-- Run in Supabase Dashboard > SQL Editor after 005_product_url.sql
CREATE TABLE IF NOT EXISTS competitors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_page_id    uuid NOT NULL REFERENCES idea_pages ON DELETE CASCADE,
  name            text NOT NULL,
  product_url     text,
  revenue         text,
  mau             text,
  topics          text[],
  extension       text DEFAULT 'unknown',
  complexity      text,
  source_url      text,
  notes           text DEFAULT '',
  added_at        timestamptz DEFAULT now()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all" ON competitors
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
