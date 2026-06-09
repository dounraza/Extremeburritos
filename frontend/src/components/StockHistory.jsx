import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search, Trash2 } from 'lucide-react';

export default function StockHistory() {
  const [depots, setDepots] = useState([]);
  const [selectedDepot, setSelectedDepot] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    const { data, error } = await supabase.from('depots').select('*');
    if (error) console.error("Error fetching depots:", error);
    else setDepots(data || []);
  };

  const fetchHistory = async () => {
    if (!selectedDepot) {
      setHistory([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    const { data, error } = await supabase
      .from('stock_transfers')
      .select('*, stock_transfer_items(*, produits(*))')
      .or(`source_depot_id.eq.${selectedDepot},dest_depot_id.eq.${selectedDepot}`);
      
    if (error) {
      console.error("Error fetching history:", error);
      setError("Impossible de charger l'historique.");
    } else {
      setHistory(data || []);
    }
    setLoading(false);
  };

  const deleteHistoryRecord = async (id) => {
    if (confirm('Voulez-vous vraiment supprimer cet enregistrement ?')) {
      const { error } = await supabase.from('stock_transfers').delete().eq('id', id);
      if (error) alert('Erreur : ' + error.message);
      else fetchHistory();
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedDepot]);

  const formatQuantity = (quantity, product) => {
    const qpu = product?.quantite_par_unite || 1;
    if (!quantity || qpu <= 1) return `${quantity || 0} ${product?.unite_base || 'unité'}`;
    
    const superior = Math.floor(quantity / qpu);
    const base = quantity % qpu;
    
    let result = '';
    if (superior > 0) result += `${superior} ${product?.unite_superieure || 'unité sup'} `;
    if (base > 0) result += `+ ${base} ${product?.unite_base || 'unité'}`;
    
    return result.trim() || '0';
  };

  const total = history.reduce((acc, h) => 
    acc + (h.stock_transfer_items?.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0) || 0), 0
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white/60 backdrop-blur-md border border-gray-50 rounded-[2.5rem] p-8 shadow-sm">
        <h2 className="text-3xl font-black text-gray-800 mb-6">Historique de stock</h2>
        
        <div className="mb-6">
          <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Sélectionner Dépôt / Magasin</label>
          <select className="w-full md:w-64 bg-white border border-gray-100 rounded-2xl py-3 px-4 text-lg font-bold mt-2" value={selectedDepot} onChange={(e) => setSelectedDepot(e.target.value)}>
            <option value="">Tous les dépôts...</option>
            {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-center py-10 font-bold text-gray-400">Chargement...</p>
        ) : error ? (
          <p className="text-center py-10 font-bold text-red-500">{error}</p>
        ) : (
          <table className="w-full text-lg">
            <thead>
              <tr className="text-[16px] text-gray-400 uppercase text-left border-b border-gray-50">
                <th className="pb-4">Date</th>
                <th className="pb-4">Désignation</th>
                <th className="pb-4">Quantité Détaillée</th>
                <th className="pb-4">Prix Achat</th>
                <th className="pb-4">Prix Vente</th>
                <th className="pb-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.length > 0 ? (
                history.map((h, i) => (
                  h.stock_transfer_items?.map((item, j) => (
                    <tr key={`${h.id}-${item.id || j}`}>
                      <td className="py-4">{new Date(h.date).toLocaleDateString()}</td>
                      <td className="py-4 font-bold">{item.produits?.name || 'Produit inconnu'}</td>
                      <td className="py-4 font-bold text-red-600">{formatQuantity(item.quantity, item.produits)}</td>
                      <td className="py-4">{Number(item.produits?.purchase_price).toLocaleString() || '0'} Ar</td>
                      <td className="py-4">{Number(item.produits?.price).toLocaleString() || '0'} Ar</td>
                      <td className="py-4 text-center">
                        <button onClick={() => deleteHistoryRecord(h.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-gray-400 font-bold">Aucun mouvement trouvé.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-100 font-black text-red-800 bg-gray-50/50">
                <td colSpan="2" className="py-4 text-right pr-4">TOTAL DES QUANTITÉS</td>
                <td className="py-4 font-bold text-red-600">{total}</td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

