-- Add is_additional column to commande_items table to track add-on orders
ALTER TABLE public.commande_items ADD COLUMN IF NOT EXISTS is_additional BOOLEAN DEFAULT false;
