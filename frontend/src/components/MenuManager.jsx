import React, { useState } from 'react';
import MenuView from './MenuView';
import MenuEditor from './MenuEditor';
import { Plus, List } from 'lucide-react';

export default function MenuManager() {
  const [activeView, setActiveView] = useState('view'); // 'view' ou 'edit'
  const [editingMenu, setEditingMenu] = useState(null);

  const handleEdit = (menu) => {
    setEditingMenu(menu);
    setActiveView('edit');
  };

  const handleCreate = () => {
    setEditingMenu(null);
    setActiveView('edit');
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Gestion des Menus</h2>
        
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex">
            <button 
                onClick={() => setActiveView('view')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-black text-sm uppercase transition-all ${activeView === 'view' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-500 hover:text-red-600'}`}
            >
                <List size={18} /> Voir la carte
            </button>
            <button 
                onClick={handleCreate}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-black text-sm uppercase transition-all ${activeView === 'edit' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-500 hover:text-red-600'}`}
            >
                <Plus size={18} /> {editingMenu ? 'Modifier Menu' : 'Créer un Menu'}
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6">
        {activeView === 'view' ? (
            <MenuView onEdit={handleEdit} />
        ) : (
            <MenuEditor menu={editingMenu} onSave={() => setActiveView('view')} />
        )}
      </div>
    </div>
  );
}
