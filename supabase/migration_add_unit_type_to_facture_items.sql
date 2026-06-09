-- Migration to add unit_type to facture_items
ALTER TABLE public.facture_items ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'base';
