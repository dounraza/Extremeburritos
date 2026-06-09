-- Tables for Delivery Notes
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  bl_number VARCHAR(50) UNIQUE, -- Can be auto-generated or manual
  bl_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  total_amount DECIMAL(12, 2) DEFAULT 0.00, -- Calculated sum of line items
  payment_type VARCHAR(20) DEFAULT 'direct_sale', -- 'credit' or 'direct_sale'
  due_date DATE, -- If payment_type is 'credit'
  advance_amount DECIMAL(12, 2) DEFAULT 0.00, -- If payment_type is 'credit' and an advance is made
  credit_frequency VARCHAR(20), -- 'daily' or 'monthly'
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.produits(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  purchase_price_per_unit DECIMAL(12, 2) NOT NULL,
  selling_price_per_unit DECIMAL(12, 2), -- Optional: for tracking if different from product's main selling price
  line_total_purchase DECIMAL(12, 2) NOT NULL, -- Calculated: quantity * purchase_price_per_unit
  line_total_selling DECIMAL(12, 2), -- Calculated: quantity * selling_price_per_unit (if applicable)
  unit VARCHAR(50) DEFAULT 'base', -- 'base' or 'superior'
  superior_unit_name VARCHAR(50), -- Name of the superior unit if used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


CREATE TABLE IF NOT EXISTS public.depots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- Stock par Dépôt
CREATE TABLE IF NOT EXISTS public.stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.produits(id) ON DELETE CASCADE,
  depot_id UUID REFERENCES public.depots(id) ON DELETE CASCADE,
  quantity DECIMAL(12, 2) DEFAULT 0,
  UNIQUE(product_id, depot_id)
);

-- Historique des Transferts
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  bt_number VARCHAR(50) UNIQUE,
  source_depot_id UUID REFERENCES public.depots(id),
  dest_depot_id UUID REFERENCES public.depots(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transfer_id UUID REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.produits(id),
  quantity DECIMAL(12, 2) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stock_transfers TO authenticated;

-- Gestion des Rôles Utilisateurs
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  depot_id UUID REFERENCES public.depots(id) ON DELETE SET NULL,
  role VARCHAR(50) DEFAULT 'user'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users on user_roles" 
ON public.user_roles FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- You might need to run these commands separately or ensure they are part of your migration script.
-- ALTER TABLE public.delivery_notes ADD CONSTRAINT fk_delivery_note_supplier FOREIGN KEY (supplier_id) REFERENCES public.fournisseurs(id) ON DELETE SET NULL;
-- ALTER TABLE public.delivery_note_items ADD CONSTRAINT fk_delivery_note_item_product FOREIGN KEY (product_id) REFERENCES public.produits(id) ON DELETE SET NULL;
