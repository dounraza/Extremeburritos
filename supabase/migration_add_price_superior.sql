-- Migration to add price_superior to produits table
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS price_superior DECIMAL(12, 2) DEFAULT 0.00;
