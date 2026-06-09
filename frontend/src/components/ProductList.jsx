import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Package, Tag, Truck, Edit2, Trash2 } from 'lucide-react';

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const formatStock = (quantity, p) => {
    const q = Number(quantity) || 0;
    const qpu = Number(p.quantite_par_unite) || 1;
    const uSup = p.unite_superieure || 'Cartons';
    const uBase = p.unite_base || 'unité';

    if (qpu > 1) {
      const superior = Math.floor(q / qpu);
      const base = q % qpu;
      return `${superior} ${uSup} + ${base} ${uBase}`;
    }
    return `${q} ${uBase}`;
  };

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('produits')
      .select('*, categories(name), fournisseurs(name), stocks(quantity, depot_id)')
      .order('name');
      
    if (data) {
      // Calculate total stock from all depots to show in catalogue
      const productsWithTotalStock = data.map(p => ({
        ...p,
        stock_quantity: p.stocks?.reduce((acc, s) => acc + Number(s.quantity), 0) || 0
      }));
      setProducts(productsWithTotalStock);
      setFilteredProducts(productsWithTotalStock);
    }
    setLoading(false);
  };

  useEffect(() => {
    setFilteredProducts(products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [searchTerm, products]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex items-center gap-4">
        <Search className="text-gray-400" />
        <input 
          placeholder="Rechercher un produit..." 
          className="flex-1 outline-none font-bold"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl overflow-hidden border border-gray-50 flex flex-col max-h-[calc(100vh-250px)]">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse sticky-header">
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
              <tr className="text-[16px] font-black text-red-800 uppercase tracking-widest">
                <th className="p-4 pl-6">Produit</th>
                <th className="p-4">Catégorie</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4 pr-6">Prix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/10 transition-colors">
                  <td className="p-4 pl-6 font-bold text-gray-800">{p.name}</td>
                  <td className="p-4 text-lg text-gray-500">{p.categories?.name || '-'}</td>
                  <td className="p-4 text-lg font-bold text-red-600 text-center">{formatStock(p.stock_quantity, p)}</td>
                  <td className="p-4 pr-6">
                    <div className="font-bold text-gray-800">{p.price.toLocaleString()} MGA <span className="text-[16px] text-gray-400">/{p.unite_base || 'unité'}</span></div>
                    {p.price_superior > 0 && (
                      <div className="text-base font-bold text-red-600">{p.price_superior.toLocaleString()} MGA <span className="text-[16px] text-red-400">/{p.unite_superieure || 'sup.'}</span></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

