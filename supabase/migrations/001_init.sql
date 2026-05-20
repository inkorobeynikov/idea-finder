-- Run in Supabase Dashboard > SQL Editor
-- Creates all tables for Idea Finder with RLS enabled

-- Raw ideas from parsing agent
CREATE TABLE parsed_ideas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  topics          text[] DEFAULT '{}',
  revenue         text,
  mau             text,
  source_platform text NOT NULL,        -- "reddit" | "ih" | "pd" | "hn"
  source_url      text NOT NULL UNIQUE,
  source_excerpt  text,
  extension       text DEFAULT 'unknown', -- "yes" | "no" | "maybe" | "unknown"
  complexity      text,                 -- "simple" | "medium" | "complex"
  parsed_at       timestamptz DEFAULT now(),
  is_reviewed     bool DEFAULT false
);

-- Idea research pages
CREATE TABLE idea_pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  status      text DEFAULT 'new',       -- "new" | "researching" | "in_work" | "rejected"
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES auth.users
);

-- Which parsed ideas belong to which page
CREATE TABLE idea_page_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_page_id    uuid NOT NULL REFERENCES idea_pages ON DELETE CASCADE,
  parsed_idea_id  uuid NOT NULL REFERENCES parsed_ideas,
  UNIQUE(idea_page_id, parsed_idea_id)
);

-- Chrome Web Store research items
CREATE TABLE cws_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_page_id uuid NOT NULL REFERENCES idea_pages ON DELETE CASCADE,
  name         text NOT NULL,
  url          text,
  installs     text,
  rating       numeric(3,1),
  paid         bool DEFAULT false,
  revenue_found text,
  sources      jsonb DEFAULT '[]',      -- [{title: string, url: string}]
  notes        text DEFAULT '',
  created_at   timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE parsed_ideas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_pages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE idea_page_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cws_items       ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can do everything
CREATE POLICY "authenticated_all" ON parsed_ideas
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON idea_pages
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON idea_page_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_all" ON cws_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
