import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Loader2, DollarSign, Calendar } from 'lucide-react';

export default function Decaissement({ session }) {
  const [decaissements, setDecaissements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({ motif: '', montant: '', categorie: 'Autre', date_decaissement: new Date().toISOString().split('T')[0] });

  useEffect(() => { fetchDecaissements(); }, []);

  const fetchDecaissements = async () => {
    setLoading(true);
    const { data } = await supabase.from('decaissements').select('*').order('date_decaissement', { ascending: false });
    if (data) setDecaissements(data);
    setLoading(false);
  };

  const addDecaissement = async (e) => {
    e.preventDefault();
    if (!formData.motif || !formData.montant) return alert("Veuillez remplir les champs obligatoires");

    setIsProcessing(true);
    const { error } = await supabase.from('decaissements').insert([{
      ...formData,
      user_id: session?.user?.id
    }]);

    if (error) alert("Erreur: " + error.message);
    else {
      setFormData({ motif: '', montant: '', categorie: 'Autre', date_decaissement: new Date().toISOString().split('T')[0] });
      fetchDecaissements();
    }
    setIsProcessing(false);
  };

  const deleteDecaissement = async (id) => {
    if (!window.confirm("Supprimer ce décaissement ?")) return;
    await supabase.from('decaissements').delete().eq('id', id);
    fetchDecaissements();
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-3xl font-black text-gray-900 uppercase">Gestion des Décaissements</h2>

      {/* Formulaire */}
      <form onSubmit={addDecaissement} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <input placeholder="Motif" className="p-2 border rounded-lg text-base" value={formData.motif} onChange={e => setFormData({...formData, motif: e.target.value})} />
        <input type="number" placeholder="Montant" className="p-2 border rounded-lg text-base" value={formData.montant} onChange={e => setFormData({...formData, montant: e.target.value})} />
        <select className="p-2 border rounded-lg text-base" value={formData.categorie} onChange={e => setFormData({...formData, categorie: e.target.value})}>
          <option>Loyer</option><option>Salaire</option><option>Fournisseur</option><option>Autre</option>
        </select>
        <button className="bg-red-600 text-white p-2 rounded-lg font-black text-base flex items-center justify-center gap-2">
          <Plus size={16} /> AJOUTER
        </button>
      </form>

      {/* Liste */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-[16px] uppercase font-black">Date</th>
              <th className="p-3 text-[16px] uppercase font-black">Motif</th>
              <th className="p-3 text-[16px] uppercase font-black">Catégorie</th>
              <th className="p-3 text-[16px] uppercase font-black text-right">Montant</th>
              <th className="p-3 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {decaissements.map(d => (
              <tr key={d.id} className="border-b">
                <td className="p-3 text-base">{new Date(d.date_decaissement).toLocaleDateString()}</td>
                <td className="p-3 text-base font-bold">{d.motif}</td>
                <td className="p-3 text-base text-gray-500">{d.categorie}</td>
                <td className="p-3 text-base font-black text-right">{Number(d.montant).toLocaleString()} Ar</td>
                <td className="p-3 text-center">
                  <button onClick={() => deleteDecaissement(d.id)} className="text-red-500"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

