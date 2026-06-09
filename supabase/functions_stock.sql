-- Function to increment stock in a specific depot
CREATE OR REPLACE FUNCTION public.increment_stock(
  p_product_id UUID,
  p_depot_id UUID,
  p_quantity DECIMAL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.stocks (product_id, depot_id, quantity)
  VALUES (p_product_id, p_depot_id, p_quantity)
  ON CONFLICT (product_id, depot_id)
  DO UPDATE SET quantity = public.stocks.quantity + EXCLUDED.quantity;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement stock in a specific depot
CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_product_id UUID,
  p_depot_id UUID,
  p_quantity DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stocks
  SET quantity = quantity - p_quantity
  WHERE product_id = p_product_id AND depot_id = p_depot_id;
END;
$$ LANGUAGE plpgsql;
