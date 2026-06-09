import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowLeftRight, ArrowDown, ArrowUp, Inbox, LogIn } from 'lucide-react';

export default function StockTransfer() {
  const [depots, setDepots] = useState([]);
  const [sourceDepotId, setSourceDepotId] = useState('');
  const [destDepotId, setDestDepotId] = useState('');
  const [sourceStocks, setSourceStocks] = useState([]);
  const [destStocks, setDestStocks] = useState([]);
  const [transferModal, setTransferModal] = useState(null);

  useEffect(() => { fetchDepots(); }, []);
  useEffect(() => {
    if (sourceDepotId) fetchStocks(sourceDepotId, setSourceStocks);
    if (destDepotId) fetchStocks(destDepotId, setDestStocks);
  }, [sourceDepotId, destDepotId]);

  const fetchDepots = async () => {
    const { data } = await supabase.from('depots').select('*').order('name');
    if (data) setDepots(data);
  };

  const fetchStocks = async (depotId, setter) => {
    const { data } = await supabase
      .from('stocks')
      .select('*, produits(name, unite_base, unite_superieure, quantite_par_unite)')
      .eq('depot_id', depotId);
    if (data) setter(data);
  };

  const handleTransfer = async (product_id, quantity, direction, unit) => {
    if (!sourceDepotId || !destDepotId) {
      alert("Veuillez sélectionner un dépôt source et un dépôt destination.");
      return;
    }
    if (sourceDepotId === destDepotId) {
      alert("Le dépôt source et le dépôt destination ne peuvent pas être identiques.");
      return;
    }
    
    const qtyValue = parseFloat(quantity);
    if (isNaN(qtyValue) || qtyValue <= 0) {
      alert("Veuillez entrer une quantité valide supérieure à 0.");
      return;
    }

    try {
      const src = direction === 'down' ? sourceDepotId : destDepotId;
      const dst = direction === 'down' ? destDepotId : sourceDepotId;
      const prod = transferModal.prod;
      
      let finalQty = qtyValue;
      if (unit === prod.unite_superieure) {
        finalQty = finalQty * (prod.quantite_par_unite || 1);
      }

      const currentStock = (direction === 'down' ? sourceStocks : destStocks).find(s => s.product_id === product_id)?.quantity || 0;
      if (finalQty > currentStock) {
        alert(`Stock insuffisant ! Disponible : ${currentStock} ${prod.unite_base}`);
        return;
      }

      await supabase.rpc('decrement_stock', { p_product_id: product_id, p_depot_id: src, p_quantity: finalQty });
      await supabase.rpc('increment_stock', { p_product_id: product_id, p_depot_id: dst, p_quantity: finalQty });
      fetchStocks(sourceDepotId, setSourceStocks);
      fetchStocks(destDepotId, setDestStocks);
      setTransferModal(null);
    } catch (e) { alert("Erreur: " + e.message); }
  };

  const formatQuantity = (quantity, p) => {
    if (!p.quantite_par_unite || p.quantite_par_unite <= 1) return `${quantity} ${p.unite_base}`;
    const superior = Math.floor(quantity / p.quantite_par_unite);
    const base = quantity % p.quantite_par_unite;
    let res = "";
    if (superior > 0) res += `${superior} ${p.unite_superieure || 'Unité'} `;
    if (base > 0) res += `+ ${base} ${p.unite_base || 'Pce'}`;
    return res.trim();
  };

  return (
    <div className="flex flex-col h-screen p-4 md:p-6 bg-gray-100">
      <header className="flex-none mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <ArrowLeftRight className="text-red-600" /> Transfert de Stock
        </h1>
      </header>

      <div className="flex-none bg-white p-4 rounded shadow-sm border border-gray-300 mb-6 grid grid-cols-2 gap-4">
        <div>
            <label className="text-base font-bold text-gray-600 uppercase mb-1 block">Dépôt Source</label>
            <select className="w-full p-2 border border-gray-400 bg-white" value={sourceDepotId} onChange={e => setSourceDepotId(e.target.value)}>
                <option value="">Sélectionner...</option>
                {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
        </div>
        <div>
            <label className="text-base font-bold text-gray-600 uppercase mb-1 block">Dépôt Destination</label>
            <select className="w-full p-2 border border-gray-400 bg-white" value={destDepotId} onChange={e => setDestDepotId(e.target.value)}>
                <option value="">Sélectionner...</option>
                {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
          <StockSection title="Stock Source" stocks={sourceStocks} formatQuantity={formatQuantity} icon={<Inbox />} action="down" onAction={(s) => setTransferModal({product_id: s.product_id, name: s.produits.name, direction: 'down', prod: s.produits})} />
          <StockSection title="Stock Destination" stocks={destStocks} formatQuantity={formatQuantity} icon={<LogIn />} action="up" onAction={(s) => setTransferModal({product_id: s.product_id, name: s.produits.name, direction: 'up', prod: s.produits})} />
      </div>

      {transferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 w-full max-w-sm border-2 border-red-600">
            <h4 className="font-bold text-lg mb-4 bg-red-600 text-white p-2">Transférer {transferModal.name}</h4>
            <div className="flex gap-2 mb-4">
                <input 
                    type="number" 
                    id="qty-input" 
                    defaultValue="1" 
                    className="w-1/2 p-2 border border-gray-400" 
                    placeholder="Quantité" 
                />
                <select id="unit-select" className="w-1/2 p-2 border border-gray-400">
                    <option value={transferModal.prod.unite_base}>{transferModal.prod.unite_base}</option>
                    {transferModal.prod.unite_superieure && <option value={transferModal.prod.unite_superieure}>{transferModal.prod.unite_superieure}</option>}
                </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTransferModal(null)} className="px-4 py-1 bg-gray-200">Annuler</button>
              <button onClick={() => handleTransfer(transferModal.product_id, document.getElementById('qty-input').value, transferModal.direction, document.getElementById('unit-select').value)} className="px-4 py-1 bg-red-600 text-white">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StockSection = ({ title, stocks, icon, action, onAction, formatQuantity }) => {
    console.log(`${title} stocks:`, stocks);
    return (
        <div className="bg-white border border-gray-300 h-full flex flex-col">
            <div className="p-3 bg-gray-200 border-b border-gray-300 font-bold text-lg flex items-center gap-2">
                {icon} {title}
            </div>
            <div className="flex-1 overflow-y-auto p-0">
                <table className="w-full text-lg text-left">
                    <thead className="bg-gray-50 border-b border-gray-300">
                        <tr><th className="p-2">Produit</th><th className="p-2">Quantité</th><th className="p-2 w-16"></th></tr>
                    </thead>
                    <tbody>
                        {stocks.map(s => (
                            <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="p-2 font-medium">{s.produits?.name || 'Inconnu'}</td>
                                <td className="p-2 font-bold text-red-600">{s.produits ? formatQuantity(s.quantity || 0, s.produits) : '0'}</td>
                                <td className="p-2 text-right">
                                    <button onClick={() => onAction(s)} className="p-1 border border-gray-400 hover:bg-red-700 hover:text-white">
                                        {action === 'down' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

