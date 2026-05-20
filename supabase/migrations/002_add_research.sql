-- Run in Supabase Dashboard > SQL Editor
-- Adds research fields to parsed_ideas

ALTER TABLE parsed_ideas
  ADD COLUMN IF NOT EXISTS research_analysis  text,
  ADD COLUMN IF NOT EXISTS research_comments  jsonb DEFAULT '[]',  -- [{author, body, score}]
  ADD COLUMN IF NOT EXISTS research_web       jsonb DEFAULT '[]',  -- [{title, url, snippet}]
  ADD COLUMN IF NOT EXISTS research_prompt    text,                -- user's custom focus note
  ADD COLUMN IF NOT EXISTS researched_at      timestamptz;
