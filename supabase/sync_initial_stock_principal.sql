-- 1. Trouver l'ID du Dépôt Principal
-- (Assumant qu'il a été créé précédemment avec le nom 'Dépôt Principal')
DO $$
DECLARE
    principal_depot_id UUID;
    prod RECORD;
BEGIN
    SELECT id INTO principal_depot_id FROM public.depots WHERE name = 'Dépôt Principal' LIMIT 1;
    
    IF principal_depot_id IS NULL THEN
        RAISE EXCEPTION 'Dépôt Principal non trouvé.';
    END IF;

    -- 2. Pour chaque produit existant, insérer ou mettre à jour son stock dans le Dépôt Principal
    FOR prod IN SELECT id, stock_quantity FROM public.produits LOOP
        INSERT INTO public.stocks (product_id, depot_id, quantity)
        VALUES (prod.id, principal_depot_id, prod.stock_quantity)
        ON CONFLICT (product_id, depot_id) DO UPDATE 
        SET quantity = EXCLUDED.quantity;
    END LOOP;
END $$;
