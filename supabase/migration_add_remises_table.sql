-- Create remises table
CREATE TABLE IF NOT EXISTS public.remises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID REFERENCES public.factures(id) ON DELETE CASCADE NOT NULL,
  facture_number VARCHAR(50),
  produit_id UUID REFERENCES public.produits(id) ON DELETE SET NULL,
  facture_item_id UUID REFERENCES public.facture_items(id) ON DELETE CASCADE,
  type_remise VARCHAR(20) NOT NULL, -- 'produit' ou 'global'
  valeur DECIMAL(15, 2) NOT NULL,
  type_valeur VARCHAR(10) NOT NULL, -- 'Ar' ou '%'
  montant_calcule DECIMAL(15, 2) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.remises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.remises TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.remises TO service_role;

-- Enable RLS
ALTER TABLE public.remises ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Enable all for authenticated users on remises" 
ON public.remises FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
