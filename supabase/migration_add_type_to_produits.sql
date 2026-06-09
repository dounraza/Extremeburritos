-- Migration to add 'type' to 'produits' table
ALTER TABLE public.produits 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'vente' 
CHECK (type IN ('vente', 'cuisine', 'fournitures', 'autres'));

-- Update existing products to have a default type if necessary (already handled by DEFAULT 'vente')
