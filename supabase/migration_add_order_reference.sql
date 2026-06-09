-- Add unique reference to commandes and factures
ALTER TABLE public.commandes ADD COLUMN IF NOT EXISTS order_reference TEXT;
ALTER TABLE public.factures ADD COLUMN IF NOT EXISTS order_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_commandes_reference ON public.commandes(order_reference);
