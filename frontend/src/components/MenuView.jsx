import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';

export default function MenuView({ onEdit }) {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMenus = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('menus')
      .select('*, menu_items(produits(name))')
      .eq('is_active', true);
    
    if (data) setMenus(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  const deleteMenu = async (id) => {
    if (!confirm('Supprimer ce menu ?')) return;
    await supabase.from('menus').update({ is_active: false }).eq('id', id);
    fetchMenus();
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-red-600" size={32} /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {menus.map(menu => (
        <div key={menu.id} className="border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all shadow-sm">
          <h3 className="text-xl font-black text-gray-800 mb-2 uppercase">{menu.name}</h3>
          <p className="text-gray-500 text-sm mb-4">{menu.description}</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm font-medium text-gray-600">
            {menu.menu_items.map(item => item.produits?.name).join(', ')}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-2xl font-black text-red-600">{menu.price.toLocaleString()} Ar</span>
            <div className="flex gap-2">
                <button onClick={() => onEdit(menu)} className="p-2 text-blue-600 bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                <button onClick={() => deleteMenu(menu.id)} className="p-2 text-red-600 bg-red-50 rounded-lg"><Trash2 size={18}/></button>
            </div>
          </div>
        </div>
      ))}
      {menus.length === 0 && (
        <div className="col-span-full text-center py-20 text-gray-400">
          <AlertCircle size={48} className="mx-auto mb-4 opacity-50"/>
          Aucun menu actif pour le moment.
        </div>
      )}
    </div>
  );
}
