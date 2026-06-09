import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Tag, Loader2 } from 'lucide-react';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setIsSubmitting(true);

    if (editingCategory) {
      const { error } = await supabase
        .from('categories')
        .update({ name: newCatName })
        .eq('id', editingCategory.id);
      
      if (error) alert(error.message);
      else {
        setNewCatName('');
        setEditingCategory(null);
        setShowModal(false);
        fetchCategories();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('categories').insert([{ name: newCatName, user_id: user.id }]);
      if (error) alert(error.message);
      else {
        setNewCatName('');
        setShowModal(false);
        fetchCategories();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setNewCatName(category.name);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setNewCatName('');
  };

  const deleteCategory = async (id) => {
    if (confirm('Supprimer cette catégorie ? Cela n\'affectera pas les produits existants mais ils n\'auront plus de catégorie.')) {
      await supabase.from('categories').delete().eq('id', id);
      fetchCategories();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-gray-50 gap-4">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2 pl-2">
          <Tag className="text-gray-500" size={20} /> Gestion des Catégories
        </h3>
        <button onClick={() => setShowModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-red-200">
          <Plus size={18} /> <span>Nouvelle Catégorie</span>
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">Nom de la catégorie</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">Date de création</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan="3" className="p-10 text-center text-gray-400">Chargement...</td></tr>
            ) : categories.length > 0 ? (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50/20 transition-colors">
                  <td className="p-5 font-bold text-gray-800">{cat.name}</td>
                  <td className="p-5 text-lg text-gray-500">{new Date(cat.created_at).toLocaleDateString()}</td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(cat)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="3" className="p-10 text-center text-gray-400">Aucune catégorie définie.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-4">
        {loading ? (
          <p className="text-center py-10 text-gray-400">Chargement...</p>
        ) : categories.length > 0 ? (
          categories.map((cat) => (
            <div key={cat.id} className="bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl p-5 shadow-sm flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-800">{cat.name}</h4>
                <p className="text-[16px] text-gray-400 uppercase mt-1">Créé le {new Date(cat.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(cat)} className="p-2 bg-gray-50 text-red-600 rounded-lg">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => deleteCategory(cat.id)} className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-10 text-gray-400">Aucune catégorie définie.</p>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-3xl font-bold text-gray-800">
                {editingCategory ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              <div className="space-y-2">
                <label className="text-base font-bold text-red-600 uppercase ml-1">Nom</label>
                <input 
                  autoFocus
                  required 
                  placeholder="Ex: Céréales, Huiles, Savons..." 
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 transition-all" 
                  value={newCatName} 
                  onChange={e => setNewCatName(e.target.value)} 
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingCategory ? "Mettre à jour" : "Créer la catégorie")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


