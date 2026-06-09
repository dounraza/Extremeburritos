-- Add date columns to remises table
ALTER TABLE public.remises 
ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS month INTEGER,
ADD COLUMN IF NOT EXISTS year INTEGER;

-- Update existing records if any
UPDATE public.remises 
SET 
  date = created_at::DATE,
  month = EXTRACT(MONTH FROM created_at),
  year = EXTRACT(YEAR FROM created_at)
WHERE date IS NULL OR month IS NULL OR year IS NULL;
