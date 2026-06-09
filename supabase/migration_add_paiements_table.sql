-- Table des paiements pour les factures
CREATE TABLE IF NOT EXISTS public.paiements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID REFERENCES public.factures(id) ON DELETE CASCADE NOT NULL,
  montant DECIMAL(12, 2) NOT NULL,
  date_paiement TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  type_paiement VARCHAR(50), -- 'avance' ou 'versement'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.paiements TO authenticated;
