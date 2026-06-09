-- Fonction pour recalculer le stock total d'un produit
CREATE OR REPLACE FUNCTION public.update_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Si c'est un INSERT ou UPDATE, on recalcule pour le produit affecté
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE public.produits
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.stocks
      WHERE product_id = NEW.product_id
    )
    WHERE id = NEW.product_id;
  -- Si c'est un DELETE, on recalcule pour le produit qui était affecté
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.produits
    SET stock_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM public.stocks
      WHERE product_id = OLD.product_id
    )
    WHERE id = OLD.product_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour la table stocks
DROP TRIGGER IF EXISTS trigger_update_product_stock ON public.stocks;
CREATE TRIGGER trigger_update_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.stocks
FOR EACH ROW
EXECUTE FUNCTION public.update_product_total_stock();
