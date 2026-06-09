import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit2, Trash2, Truck, Search, Mail, Phone, MapPin, Loader2, History, Banknote, LayoutGrid, List } from 'lucide-react';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', email: '', phone: '', address: '',
    local_etranger: 'Local', raison_sociale: '',
    nif: '', stat: '', rcs: ''
  });
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [creditModal, setCreditModal] = useState(null);
  const [supplierCredits, setSupplierCredits] = useState([]);

  const fetchSupplierCredits = async (supplierId) => {
    const { data } = await supabase
      .from('delivery_notes')
      .select(`
        *,
        delivery_note_items (
          quantity,
          produits (name)
        ),
        paiements (*),
        fournisseurs!delivery_notes_supplier_id_fkey (*)
      `)
      .eq('supplier_id', supplierId)
      .eq('payment_type', 'credit');
    setSupplierCredits(data || []);
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await supabase.from('fournisseurs').select('*').order('name');
    if (data) {
      setSuppliers(data);
      setFilteredSuppliers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const currentSuppliers = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.raison_sociale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.nif?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSuppliers(currentSuppliers);
    } else {
      setFilteredSuppliers(suppliers);
    }
  }, [suppliers, searchTerm]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (editingSupplier) {
      const { error } = await supabase
        .from('fournisseurs')
        .update(formData)
        .eq('id', editingSupplier.id);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchSuppliers();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('fournisseurs').insert([{ ...formData, user_id: user.id }]);
      if (error) alert(error.message);
      else {
        resetForm();
        fetchSuppliers();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      local_etranger: supplier.local_etranger || 'Local',
      raison_sociale: supplier.raison_sociale || '',
      nif: supplier.nif || '',
      stat: supplier.stat || '',
      rcs: supplier.rcs || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      email: '', 
      phone: '', 
      address: '',
      local_etranger: 'Local',
      raison_sociale: '',
      nif: '',
      stat: '',
      rcs: ''
    });
    setEditingSupplier(null);
    setShowModal(false);
  };

  const deleteSupplier = async (id) => {
    if (confirm('Supprimer ce fournisseur ?')) {
      await supabase.from('fournisseurs').delete().eq('id', id);
      fetchSuppliers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-gray-50 gap-4">
        <div className="flex gap-4 flex-1 max-w-lg items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un fournisseur..." 
              className="w-full bg-white border border-gray-100 rounded-xl py-2 pl-10 pr-4 text-lg focus:ring-2 focus:ring-red-500/20 transition-all outline-none" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}
              title="Vue Grille"
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('table')} 
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}
              title="Vue Tableau"
            >
              <List size={18} />
            </button>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-red-200">
          <Plus size={18} /> <span>Nouveau Fournisseur</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p>Chargement des fournisseurs...</p>
        </div>
      ) : filteredSuppliers.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((s) => (
              <div key={s.id} className="bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => handleEdit(s)} className="p-2 text-gray-300 hover:text-red-600 transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteSupplier(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-red-600">
                    <Truck size={28} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-800 leading-tight">{s.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[14px] font-black uppercase px-2 py-0.5 rounded-full ${s.local_etranger === 'Etranger' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-red-600'}`}>
                        {s.local_etranger || 'Local'}
                      </span>
                      {s.nif && (
                        <span className="text-[14px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                          NIF: {s.nif}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {s.raison_sociale && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <div className="w-4 h-4 rounded bg-gray-50 flex items-center justify-center">
                        <span className="text-[14px] font-black">RS</span>
                      </div>
                      <span className="text-base font-bold text-gray-400 uppercase truncate">{s.raison_sociale}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-gray-600">
                    <Mail size={16} className="text-red-400" />
                    <span className="text-lg truncate">{s.email || 'Pas d\'email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone size={16} className="text-red-400" />
                    <span className="text-lg">{s.phone || 'Pas de téléphone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <MapPin size={16} className="text-red-400" />
                    <span className="text-lg truncate">{s.address || 'Pas d\'adresse'}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-50 flex gap-2">
                  <button onClick={() => { setCreditModal(s); fetchSupplierCredits(s.id); }} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-[15px] uppercase tracking-wider hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-red-200">
                    <Banknote size={14} /> Payer
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[16px] font-black text-red-800 uppercase tracking-widest border-b border-gray-100">
                    <th className="p-4 pl-6">Fournisseur</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Raison Sociale</th>
                    <th className="p-4">NIF</th>
                    <th className="p-4">Contact</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/10 transition-colors text-lg group">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-gray-800 uppercase">{s.name}</div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[15px] font-black uppercase px-2 py-0.5 rounded-full ${s.local_etranger === 'Etranger' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-red-600'}`}>
                          {s.local_etranger || 'Local'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-base text-gray-400 font-bold uppercase truncate max-w-[150px] block">{s.raison_sociale || '-'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-[16px] font-bold text-gray-500">{s.nif || '-'}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-base font-bold text-gray-700">{s.phone || '-'}</span>
                          <span className="text-[16px] text-gray-400">{s.email || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => handleEdit(s)} className="p-2 text-gray-300 hover:text-red-600 transition-colors" title="Modifier">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => deleteSupplier(s.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Supprimer">
                            <Trash2 size={16} />
                          </button>
                          <div className="h-6 w-px bg-gray-50 mx-1"></div>
                          <button onClick={() => { setCreditModal(s); fetchSupplierCredits(s.id); }} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all" title="Crédits">
                            <Banknote size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="text-center py-20 bg-white/40 border-2 border-dashed border-gray-100 rounded-3xl">
          <Truck className="mx-auto text-gray-300 mb-4" size={48} />

          <p className="text-gray-500 font-medium">Aucun fournisseur trouvé.</p>
        </div>
      )}

      {creditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Détails Crédits: {creditModal.name}</h3>
              <button onClick={() => setCreditModal(null)} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {supplierCredits.length > 0 ? supplierCredits.map(c => (
                    <div key={c.id} className="border border-gray-100 rounded-2xl overflow-hidden mb-4">
                        <div className="bg-gray-50 p-3 flex justify-between items-center font-black text-red-800 text-base uppercase tracking-widest">
                            <span>BL: {c.bl_number}</span>
                            <span>{c.total_amount.toLocaleString()} Ar</span>
                        </div>
                        <div className="p-3 grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-[16px] uppercase font-black text-gray-400 mb-2">Produits</h4>
                                <table className="w-full text-base">
                                    <tbody>
                                        {c.delivery_note_items.map((item, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-1">{item.produits?.name || 'Inconnu'}</td>
                                                <td className="p-1 text-right font-bold">{item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h4 className="text-[16px] uppercase font-black text-gray-400 mb-2">Historique Paiements</h4>
                                <table className="w-full text-base">
                                    <tbody>
                                        {(c.paiements || []).map((p, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-1 text-[15px] font-bold text-gray-500">{new Date(p.date_paiement).toLocaleDateString()}</td>
                                                <td className="p-1 font-bold">{p.montant.toLocaleString()} Ar</td>
                                            </tr>
                                        ))}
                                        {(c.paiements || []).length === 0 && <tr className="text-gray-400 italic"><td>Aucun paiement</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )) : <p className="text-gray-400 text-center py-4 text-base font-black uppercase">Aucun crédit en cours</p>}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-gray-800">
                {editingSupplier ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3 max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                   <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">Type de Fournisseur</label>
                   <select 
                    className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base font-bold"
                    value={formData.local_etranger}
                    onChange={e => setFormData({...formData, local_etranger: e.target.value})}
                  >
                    <option value="Local">Local</option>
                    <option value="Etranger">Étranger</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">Nom du Fournisseur</label>
                  <input required placeholder="Ex: Sanofi, GSK..." className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="col-span-2">
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">Raison Sociale</label>
                  <input placeholder="Raison Sociale complète" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.raison_sociale} onChange={e => setFormData({...formData, raison_sociale: e.target.value})} />
                </div>

                <div>
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">NIF</label>
                  <input placeholder="NIF" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.nif} onChange={e => setFormData({...formData, nif: e.target.value})} />
                </div>
                <div>
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">STAT</label>
                  <input placeholder="STAT" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.stat} onChange={e => setFormData({...formData, stat: e.target.value})} />
                </div>
                <div>
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">RCS</label>
                  <input placeholder="RCS" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.rcs} onChange={e => setFormData({...formData, rcs: e.target.value})} />
                </div>
                <div>
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">Téléphone</label>
                  <input placeholder="Téléphone" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>

                <div className="col-span-2">
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">Email contact</label>
                  <input type="email" placeholder="Email" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>

                <div className="col-span-2">
                  <label className="text-[15px] font-black uppercase text-red-600 mb-0.5 block ml-1">Adresse du siège</label>
                  <textarea placeholder="Adresse complète..." className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-base min-h-[40px] h-[40px] resize-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}></textarea>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 mt-2 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (editingSupplier ? "Mettre à jour" : "Enregistrer")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

