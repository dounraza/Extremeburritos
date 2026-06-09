import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Users, Search, Mail, Phone, MapPin, Loader2, Clock, List, LayoutGrid } from 'lucide-react';

export default function Clients({ onViewCredit }) {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // Default to table for a "finer" look
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', nif: '', stat: '' });
  const [editingClient, setEditingClient] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) {
      setClients(data);
      setFilteredClients(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const currentClients = clients.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.nif?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.stat?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClients(currentClients);
    } else {
      setFilteredClients(clients);
    }
  }, [clients, searchTerm]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (editingClient) {
      const { error } = await supabase
        .from('clients')
        .update(formData)
        .eq('id', editingClient.id);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchClients();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('clients').insert([{ ...formData, user_id: user.id }]);
      if (error) alert(error.message);
      else {
        resetForm();
        fetchClients();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      nif: client.nif || '',
      stat: client.stat || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', address: '', nif: '', stat: '' });
    setEditingClient(null);
    setShowModal(false);
  };

  const deleteClient = async (id) => {
    if (confirm('Supprimer ce client ?')) {
      await supabase.from('clients').delete().eq('id', id);
      fetchClients();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-gray-50 gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un client..." 
              className="w-full bg-white border border-gray-100 rounded-2xl py-2 pl-10 pr-4 text-lg focus:ring-4 focus:ring-red-500/20 transition-all outline-none" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button 
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[16px] font-black transition-all ${viewMode === 'table' ? 'bg-white text-red-600 shadow-sm' : 'text-red-600 hover:bg-white/50'}`}
            >
              <List size={14} /> LISTE
            </button>
            <button 
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[16px] font-black transition-all ${viewMode === 'cards' ? 'bg-white text-red-600 shadow-sm' : 'text-red-600 hover:bg-white/50'}`}
            >
              <LayoutGrid size={14} /> CARTES
            </button>
          </div>
        </div>

        <button onClick={() => setShowModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-2xl flex items-center justify-center gap-2 font-black text-[16px] uppercase tracking-widest transition-all shadow-lg shadow-red-200">
          <Plus size={18} /> <span>Nouveau Client</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center"><p className="text-gray-400 font-bold animate-pulse uppercase text-[16px] tracking-widest">Chargement des clients...</p></div>
      ) : filteredClients.length > 0 ? (
        viewMode === 'table' ? (
          /* Table View - "Finer" look */
          <div className="bg-white/60 backdrop-blur-md border border-gray-50 rounded-[2.5rem] overflow-hidden shadow-sm animate-in fade-in duration-300 overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-4 pl-8 text-[16px] font-black text-red-600 uppercase tracking-widest">Nom</th>
                  <th className="p-4 text-[16px] font-black text-red-600 uppercase tracking-widest">Contact</th>
                  <th className="p-4 text-[16px] font-black text-red-600 uppercase tracking-widest">NIF / STAT</th>
                  <th className="p-4 text-[16px] font-black text-red-600 uppercase tracking-widest">Adresse</th>
                  <th className="p-4 pr-8 text-[16px] font-black text-red-600 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/30 transition-colors group">
                    <td className="p-4 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-red-600 shrink-0">
                          <Users size={16} />
                        </div>
                        <span className="text-base font-black text-gray-800 uppercase tracking-tight">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Phone size={10} className="text-red-400" />
                          <span className="text-[16px] font-bold">{c.phone || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Mail size={10} className="text-gray-400" />
                          <span className="text-[16px]">{c.email || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {c.nif && <span className="text-[15px] font-black bg-gray-50 text-red-600 px-2 py-0.5 rounded border border-gray-100 uppercase">NIF: {c.nif}</span>}
                        {c.stat && <span className="text-[15px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 uppercase">STAT: {c.stat}</span>}
                      </div>
                    </td>
                    <td className="p-4 text-[16px] font-medium text-gray-500 max-w-[150px] truncate">
                      {c.address || '-'}
                    </td>
                    <td className="p-4 pr-8 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onViewCredit?.(c.name)} className="p-2 text-red-600 hover:bg-gray-50 rounded-lg transition-all" title="Échéances">
                          <Clock size={14} />
                        </button>
                        <button onClick={() => handleEdit(c)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-50 rounded-lg transition-all">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteClient(c.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in duration-300">
            {filteredClients.map((c) => (
              <div key={c.id} className="bg-white/60 backdrop-blur-md border border-gray-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-4 right-4 flex gap-1">
                  <button onClick={() => handleEdit(c)} className="p-2 text-gray-300 hover:text-red-600 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteClient(c.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-red-600">
                    <Users size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-gray-800 uppercase tracking-tight">{c.name}</h4>
                    <p className="text-[15px] text-red-600 font-bold uppercase tracking-widest">Client</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail size={14} className="text-red-400" />
                    <span className="text-base truncate font-medium">{c.email || 'Pas d\'email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone size={14} className="text-red-400" />
                    <span className="text-base font-bold">{c.phone || 'Pas de téléphone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPin size={14} className="text-red-400" />
                    <span className="text-base truncate font-medium">{c.address || 'Pas d\'adresse'}</span>
                  </div>
                  {(c.nif || c.stat) && (
                    <div className="pt-2 mt-2 border-t border-gray-50 grid grid-cols-2 gap-2">
                      {c.nif && (
                        <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100/50">
                          <p className="text-[13px] font-black text-red-600 uppercase leading-none mb-1">NIF</p>
                          <p className="text-[16px] font-black text-gray-700">{c.nif}</p>
                        </div>
                      )}
                      {c.stat && (
                        <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-100/50">
                          <p className="text-[13px] font-black text-blue-600 uppercase leading-none mb-1">STAT</p>
                          <p className="text-[16px] font-black text-gray-700">{c.stat}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <button 
                    onClick={() => onViewCredit?.(c.name)}
                    className="w-full py-2.5 bg-gray-50 text-red-600 rounded-xl font-black text-[15px] uppercase tracking-widest hover:bg-red-700 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Clock size={14} /> Échéances
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="col-span-full text-center py-20 bg-white/40 border-2 border-dashed border-gray-100 rounded-[2.5rem]">
          <Users className="mx-auto text-emerald-200 mb-4" size={48} />
          <p className="text-gray-500 font-black uppercase text-[16px] tracking-widest">Aucun client trouvé.</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-3xl font-black text-gray-800 uppercase tracking-tight">
                {editingClient ? 'Modifier le client' : 'Ajouter un client'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[16px] font-black text-red-600 uppercase ml-1">Nom complet</label>
                <input required className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-red-500/20 transition-all text-lg font-bold uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[16px] font-black text-red-600 uppercase ml-1">Email</label>
                  <input type="email" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-red-500/20 transition-all text-lg font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[16px] font-black text-red-600 uppercase ml-1">Téléphone</label>
                  <input className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-red-500/20 transition-all text-lg font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[16px] font-black text-red-600 uppercase ml-1">NIF</label>
                  <input className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-red-500/20 transition-all text-lg font-bold" value={formData.nif} onChange={e => setFormData({...formData, nif: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[16px] font-black text-red-600 uppercase ml-1">STAT</label>
                  <input className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-red-500/20 transition-all text-lg font-bold" value={formData.stat} onChange={e => setFormData({...formData, stat: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[16px] font-black text-red-600 uppercase ml-1">Adresse</label>
                <textarea className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-red-500/20 transition-all text-lg font-medium min-h-[80px]" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}></textarea>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-black text-[16px] uppercase tracking-[0.2em] py-4 rounded-2xl shadow-lg shadow-red-200 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingClient ? "Mettre à jour" : "Enregistrer le client")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


