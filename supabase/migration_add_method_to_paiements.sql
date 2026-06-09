-- Ajout de la colonne method et reference à la table paiements
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS method VARCHAR(50);
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS reference VARCHAR(100);
