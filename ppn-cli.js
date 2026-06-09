#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Erreur: Les variables SUPABASE_URL et SUPABASE_ANON_KEY doivent être définies dans votre fichier .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const args = process.argv.slice(2);
const command = args[0];

async function listProducts() {
  const { data, error } = await supabase
    .from('produits')
    .select('name, stock_quantity, price');
  
  if (error) {
    console.error('Erreur lors de la récupération des produits:', error.message);
    return;
  }

  console.log('\n--- ÉTAT DES STOCKS PPN ---');
  console.table(data.map(p => ({
    'Produit': p.name,
    'Stock': p.stock_quantity,
    'Prix (MGA)': Number(p.price).toLocaleString('fr-MG')
  })));
}

async function updateStock(name, quantity) {
  // Find product by name
  const { data: products, error: searchError } = await supabase
    .from('produits')
    .select('id, name, stock_quantity')
    .ilike('name', `%${name}%`);

  if (searchError || !products.length) {
    console.error(`Produit "${name}" non trouvé.`);
    return;
  }

  const product = products[0];
  const newQuantity = product.stock_quantity + parseInt(quantity);

  const { error: updateError } = await supabase
    .from('produits')
    .update({ stock_quantity: newQuantity })
    .eq('id', product.id);

  if (updateError) {
    console.error('Erreur lors de la mise à jour:', updateError.message);
  } else {
    console.log(`✅ Stock mis à jour pour "${product.name}": ${product.stock_quantity} -> ${newQuantity}`);
  }
}

async function main() {
  switch (command) {
    case 'list':
      await listProducts();
      break;
    case 'add':
      if (args.length < 3) {
        console.log('Usage: npm run stock add "Nom du produit" quantité');
        console.log('Exemple: npm run stock add "Riz" 50');
      } else {
        await updateStock(args[1], args[2]);
      }
      break;
    default:
      console.log('--- GESTION DE STOCK PPN (CLI) ---');
      console.log('Commandes disponibles :');
      console.log('  list           : Afficher tous les produits');
      console.log('  add "Nom" qté  : Ajouter (ou retirer si négatif) de la quantité au stock');
      console.log('\nExemple: npm run stock list');
  }
}

main();
