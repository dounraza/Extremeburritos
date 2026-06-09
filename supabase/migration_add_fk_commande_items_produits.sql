-- Add foreign key relationship if missing
ALTER TABLE public.commande_items 
ADD CONSTRAINT fk_commande_items_produits 
FOREIGN KEY (item_id) REFERENCES public.produits(id);
