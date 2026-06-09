-- S'assurer que le RLS est activé
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

-- Créer une politique pour autoriser les utilisateurs authentifiés à effectuer toutes les opérations
CREATE POLICY "Enable all for authenticated users on paiements" 
ON public.paiements FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
