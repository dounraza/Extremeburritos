-- Create table for admin settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(50) UNIQUE NOT NULL,
  value VARCHAR(255) NOT NULL
);

-- Insert default admin code
INSERT INTO public.admin_settings (key, value) 
VALUES ('admin_code', '0000')
ON CONFLICT (key) DO NOTHING;
