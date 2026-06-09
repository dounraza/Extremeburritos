-- 1. Créer le dépôt principal
INSERT INTO public.depots (name, location)
VALUES ('Dépôt Principal', 'Siège');

-- 2. Récupérer l'ID du dépôt principal créé
-- (À exécuter dans l'éditeur SQL Supabase pour obtenir l'ID ou utiliser une variable)
-- DO $$
-- DECLARE
--   principal_depot_id UUID;
-- BEGIN
--   SELECT id INTO principal_depot_id FROM public.depots WHERE name = 'Dépôt Principal' LIMIT 1;
-- 
--   -- 3. Mettre à jour les stocks existants qui n'ont pas de depot_id
--   UPDATE public.stocks
--   SET depot_id = principal_depot_id
--   WHERE depot_id IS NULL;
-- END $$;
