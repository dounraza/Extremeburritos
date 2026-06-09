import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Box, Save, Loader2, CheckCircle, MapPin, Phone, Mail, FileText, Edit2, X, Trash2, Plus } from 'lucide-react';

export default function Depots() {
  const [depots, setDepots] = useState([]);
  const [formData, setFormData] = useState({ 
    name: '', 
    location: '', 
    phone: '', 
    email: '', 
    nif: '', 
    stat: '', 
    address: '' 
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from('depots').select('*').order('created_at');
        if (error) throw error;
        setDepots(data || []);
    } catch (err) {
        console.error("Erreur fetchDepots:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('depots').update(formData).eq('id', editingId);
        if (error) throw error;
        setSuccessMessage('Dépôt mis à jour !');
      } else {
        const { error } = await supabase.from('depots').insert([formData]);
        if (error) throw error;
        setSuccessMessage('Dépôt ajouté !');
      }
      
      setFormData({ name: '', location: '', phone: '', email: '', nif: '', stat: '', address: '' });
      setEditingId(null);
      setShowModal(false);
      fetchDepots();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (depot) => {
    setEditingId(depot.id);
    setFormData({
      name: depot.name || '',
      location: depot.location || '',
      phone: depot.phone || '',
      email: depot.email || '',
      nif: depot.nif || '',
      stat: depot.stat || '',
      address: depot.address || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ce dépôt ?")) return;
    try {
      const { error } = await supabase.from('depots').delete().eq('id', id);
      if (error) throw error;
      fetchDepots();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {successMessage && (
        <div className="bg-gray-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          <span className="font-bold text-lg">{successMessage}</span>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-md border border-gray-50/50 rounded-3xl p-6 md:p-10 shadow-sm">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 uppercase tracking-widest">Gestion des Dépôts</h2>
                <p className="text-[16px] font-medium text-gray-400 uppercase tracking-widest mt-1">Liste et configuration des points de vente</p>
            </div>
            <button 
                onClick={() => { setEditingId(null); setFormData({ name: '', location: '', phone: '', email: '', nif: '', stat: '', address: '' }); setShowModal(true); }}
                className="bg-red-600 text-white rounded-xl py-3 px-6 font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200/50 active:scale-95 text-base uppercase tracking-widest flex items-center gap-2"
            >
                <Plus size={16} /> Ajouter un dépôt
            </button>
        </div>

        <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-50/50">
                  <th className="py-4 px-4">Dépôt</th>
                  <th className="py-4 px-4">Localisation / Adresse</th>
                  <th className="py-4 px-4">Contact</th>
                  <th className="py-4 px-4">NIF / STAT</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/30">
                {depots.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50/10 transition-colors group">
                    <td className="py-3 px-4">
                      <p className="text-[17px] font-bold text-gray-700 uppercase">{d.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-[16px] font-medium text-gray-400 uppercase tracking-tight" title={d.address}>{d.address || d.location || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        {d.phone && <p className="text-[15px] font-bold text-gray-600 flex items-center gap-1"><Phone size={9} /> {d.phone}</p>}
                        {d.email && <p className="text-[15px] font-medium text-red-600 flex items-center gap-1"><Mail size={9} /> {d.email}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        {d.nif && <p className="text-[15px] font-bold text-gray-500 uppercase tracking-tighter">NIF: {d.nif}</p>}
                        {d.stat && <p className="text-[15px] font-bold text-gray-500 uppercase tracking-tighter">STAT: {d.stat}</p>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(d)} className="p-1.5 text-red-600 hover:bg-gray-50 rounded-lg transition-all" title="Modifier">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(d.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all" title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-2 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-50/50">
            <div className="p-6 md:p-8 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center">
                <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">
                    {editingId ? 'Modifier le dépôt' : 'Nouveau Dépôt'}
                </h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-gray-400 hover:text-red-500 shadow-sm transition-all hover:rotate-90">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Nom du dépôt *</label>
                    <input required type="text" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Localisation courte</label>
                    <input type="text" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Téléphone</label>
                    <input type="text" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Email</label>
                    <input type="email" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">NIF</label>
                    <input type="text" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.nif} onChange={(e) => setFormData({...formData, nif: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">STAT</label>
                    <input type="text" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.stat} onChange={(e) => setFormData({...formData, stat: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Adresse complète</label>
                    <textarea rows="2" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl py-3 px-4 text-base font-bold outline-none focus:border-gray-500 transition-all" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-red-600 text-white rounded-xl py-4 font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200/50 active:scale-95 text-base uppercase tracking-widest">
                {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editingId ? 'Mettre à jour' : 'Enregistrer')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

