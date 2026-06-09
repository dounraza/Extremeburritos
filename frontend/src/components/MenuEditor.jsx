import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Plus, X } from 'lucide-react';

export default function MenuEditor({ menu, onSave }) {
  const [formData, setFormData] = useState(menu || { name: '', price: '', description: '', items: [] });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('produits').select('id, name').order('name');
      if (data) setProducts(data);
    };
    fetchProducts();
    
    // Si on édite un menu, charger ses items actuels
    if (menu) {
        const fetchItems = async () => {
            const { data } = await supabase
                .from('menu_items')
                .select('produit_id, produits(id, name)')
                .eq('menu_id', menu.id);
            if (data) {
                setFormData(prev => ({ ...prev, items: data.map(d => d.produits) }));
            }
        };
        fetchItems();
    }
  }, [menu]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (menu) {
      // Update
      await supabase.from('menus').update({ name: formData.name, price: formData.price, description: formData.description }).eq('id', menu.id);
      await supabase.from('menu_items').delete().eq('menu_id', menu.id);
      await supabase.from('menu_items').insert(formData.items.map(item => ({ menu_id: menu.id, produit_id: item.id })));
    } else {
      // Create
      const { data: newMenu } = await supabase.from('menus').insert({ name: formData.name, price: formData.price, description: formData.description }).select().single();
      await supabase.from('menu_items').insert(formData.items.map(item => ({ menu_id: newMenu.id, produit_id: item.id })));
    }
    
    setLoading(false);
    onSave();
  };

  const addItem = (productId) => {
    const prod = products.find(p => p.id === productId);
    if (prod && !formData.items.find(i => i.id === productId)) {
        setFormData({...formData, items: [...formData.items, prod]});
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <input required placeholder="Nom du menu" className="col-span-2 p-4 bg-gray-50 rounded-xl outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input required type="number" placeholder="Prix (Ar)" className="p-4 bg-gray-50 rounded-xl outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
        <input placeholder="Description" className="p-4 bg-gray-50 rounded-xl outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
      </div>

      <div className="space-y-4">
        <label className="block font-black text-gray-400 uppercase text-xs">Ajouter des produits au menu</label>
        <select onChange={(e) => addItem(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl outline-none">
            <option value="">Choisir un produit...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
            {formData.items.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm">
                    {item.name}
                    <button type="button" onClick={() => setFormData({...formData, items: formData.items.filter(i => i.id !== item.id)})}><X size={14}/></button>
                </div>
            ))}
        </div>
      </div>

      <button disabled={loading} className="w-full bg-red-600 text-white p-4 rounded-xl font-black uppercase shadow-lg shadow-red-200">
        {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Enregistrer le menu'}
      </button>
    </form>
  );
}
