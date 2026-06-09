-- Rename price_at_sale to unit_price in facture_items
ALTER TABLE public.facture_items RENAME COLUMN price_at_sale TO unit_price;
