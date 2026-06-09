-- Ajout des informations de facturation à la table depots
ALTER TABLE public.depots ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.depots ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE public.depots ADD COLUMN IF NOT EXISTS nif VARCHAR(50);
ALTER TABLE public.depots ADD COLUMN IF NOT EXISTS stat VARCHAR(50);
ALTER TABLE public.depots ADD COLUMN IF NOT EXISTS address TEXT;
