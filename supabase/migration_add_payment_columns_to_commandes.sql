-- Add payment_method column to commandes table
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS payment_phone TEXT;
