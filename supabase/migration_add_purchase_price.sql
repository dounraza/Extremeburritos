-- Migration pour ajouter le prix d'achat
ALTER TABLE public.produits ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12, 2) DEFAULT 0.00;
ALTER TABLE public.stocks ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12, 2) DEFAULT 0.00;
