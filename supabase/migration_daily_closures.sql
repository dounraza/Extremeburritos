-- Create daily_closures table
CREATE TABLE IF NOT EXISTS public.daily_closures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  closure_date DATE NOT NULL,
  total_cash DECIMAL(15, 2) DEFAULT 0,
  total_credit DECIMAL(15, 2) DEFAULT 0,
  total_advances DECIMAL(15, 2) DEFAULT 0,
  total_journalier DECIMAL(15, 2) DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
