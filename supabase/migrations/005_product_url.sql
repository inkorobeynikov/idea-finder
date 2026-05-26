-- Run in Supabase Dashboard > SQL Editor
ALTER TABLE parsed_ideas ADD COLUMN IF NOT EXISTS product_url text;
