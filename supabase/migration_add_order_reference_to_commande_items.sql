-- Add order_reference column to commande_items table
ALTER TABLE public.commande_items ADD COLUMN IF NOT EXISTS order_reference TEXT;
