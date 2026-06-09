import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ShoppingCart, CheckCircle, Loader2, Utensils, Search, CreditCard } from 'lucide-react';

export default function RestaurantPOS({ session, selectedDepotId }) {
  const [readyOrders, setReadyOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = readyOrders.filter(order => 
    order.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchOrders = async () => {
    // 1. Fetch commands with all active statuses
    const { data, error } = await supabase
      .from('commandes')
      .select(`
        *,
        commande_items (*)
      `)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching orders:", error);
      setLoading(false);
      return;
    }

    // 2. Manually enrich items with product names (same as before)
    const ordersWithProducts = await Promise.all((data || []).map(async (order) => {
        const itemsWithNames = await Promise.all(order.commande_items.map(async (item) => {
            if (item.item_type === 'product') {
                const { data: prodData } = await supabase
                    .from('produits')
                    .select('name')
                    .eq('id', item.item_id)
                    .single();
                return { ...item, produits: prodData };
            }
            return { ...item, produits: { name: 'Menu' } };
        }));
        return { ...order, commande_items: itemsWithNames };
    }));

    setReadyOrders(ordersWithProducts);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('all-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commande_items' }, fetchOrders)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleFinalizePayment = async () => {
    if (!selectedOrder || selectedOrder.status !== 'ready') {
        alert("Cette commande n'est pas encore prête à être encaissée.");
        return;
    }
    setIsProcessing(true);
    try {
      // 1. Update commande status to paid
      const { error: cmdErr } = await supabase
        .from('commandes')
        .update({ status: 'paid' })
        .eq('id', selectedOrder.id);
      
      if (cmdErr) throw cmdErr;

      // 2. Process each item for stock and movements
      if (selectedOrder.commande_items) {
        for (const item of selectedOrder.commande_items) {
          if (item.item_type !== 'product') continue; // Simple stock update for products only

          // Get current stock
          const { data: stockData, error: stockFetchErr } = await supabase
            .from('stocks')
            .select('id, quantity')
            .eq('product_id', item.item_id)
            .eq('depot_id', selectedDepotId)
            .maybeSingle();

          if (stockData) {
            const newQuantity = Math.max(0, Number(stockData.quantity) - Number(item.quantity));
            await supabase
              .from('stocks')
              .update({ quantity: newQuantity })
              .eq('id', stockData.id);
          }

          // Record stock movement
          await supabase.from('stock_movements').insert([{
            product_id: item.item_id,
            type: 'out',
            quantity: item.quantity,
            price_at_movement: item.unit_price,
            reason: `Vente Restaurant (Table ${selectedOrder.table_name})`,
            user_id: session?.user?.id,
            depot_id: selectedDepotId
          }]);
        }
      }

      alert('Encaissement réussi !');
      setSelectedOrder(null);
      fetchOrders();
    } catch (e) {
      alert("Erreur lors de l'encaissement : " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-red-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="flex flex-col md:flex-row h-full overflow-hidden">
        
        {/* Ready Orders List - Hidden on mobile when an order is selected */}
        <div className={`w-full md:w-80 lg:w-96 flex flex-col gap-4 p-4 border-r border-gray-200 bg-white shrink-0 ${selectedOrder ? 'hidden md:flex' : 'flex'}`}>
          <div className="shrink-0">
            <h3 className="font-black text-gray-800 uppercase flex items-center gap-2 text-sm md:text-base">
              <Utensils size={20} className="text-red-600" /> Commandes Prêtes
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">En attente d'encaissement</p>
          </div>
          
          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher table..." 
                className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl font-bold outline-none border-2 border-transparent focus:border-red-500 transition-all text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {filteredOrders.map(order => (
              <button
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className={`w-full p-4 rounded-2xl text-left transition-all border-2 flex justify-between items-center group active:scale-[0.98] ${
                selectedOrder?.id === order.id 
                ? 'bg-red-600 text-white border-red-600 shadow-lg' 
                : 'bg-gray-50 text-gray-800 border-transparent hover:border-red-200'
              }`}
              >
              <div>
                <div className="text-xl font-black">{order.table_name}</div>
                <div className={`text-[10px] font-bold uppercase ${selectedOrder?.id === order.id ? 'text-red-200' : 'text-gray-400'}`}>
                  {order.id.slice(-6).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="text-lg font-black">{Number(order.total_amount || 0).toLocaleString()}</div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  order.status === 'ready' 
                  ? (selectedOrder?.id === order.id ? 'bg-white/20' : 'bg-green-100 text-green-700')
                  : (selectedOrder?.id === order.id ? 'bg-white/20' : 'bg-orange-100 text-orange-700')
                }`}>
                  {order.status === 'ready' ? 'Prêt' : 'En cours'}
                </span>
              </div>
              </button>
            ))}
            {filteredOrders.length === 0 && (
              <div className="text-center py-20 text-gray-300">
                <CheckCircle size={48} className="mx-auto mb-4 opacity-10" />
                <p className="font-black uppercase text-xs tracking-widest">Aucune commande trouvée</p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Details / View - Full width on mobile when selected */}
        <div className={`flex-1 flex flex-col bg-gray-50 overflow-hidden ${!selectedOrder ? 'hidden md:flex' : 'flex'}`}>
          {selectedOrder ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header for Order Details */}
              <div className="p-4 md:p-8 bg-gray-900 text-white shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative">
                {/* Back button for mobile */}
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="md:hidden absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white"
                >
                  <Search size={24} className="rotate-45" /> 
                </button>
                
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-red-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Paiement</span>
                    <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">ID: {selectedOrder.id.slice(-6).toUpperCase()}</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">{selectedOrder.table_name}</h2>
                </div>
                
                <div className="text-left sm:text-right">
                  <p className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Montant Total</p>
                  <p className="text-4xl md:text-5xl font-black text-red-500">{Number(selectedOrder.total_amount || 0).toLocaleString()} <span className="text-sm">Ar</span></p>
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-4 md:p-6 text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">Article</th>
                        <th className="p-4 md:p-6 text-center text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">Quantité</th>
                        <th className="p-4 md:p-6 text-right text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedOrder.commande_items.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 md:p-6">
                            <div className="font-black text-gray-800 uppercase text-sm md:text-base leading-tight">
                              {item.produits?.name || 'Menu/Produit'}
                            </div>
                            <div className="text-[10px] font-bold text-gray-400 mt-0.5">
                              {item.unit_price.toLocaleString()} Ar / unité
                            </div>
                          </td>
                          <td className="p-4 md:p-6 text-center">
                            <span className="bg-gray-100 px-3 py-1 rounded-full font-black text-gray-700 text-sm">
                              x{item.quantity}
                            </span>
                          </td>
                          <td className="p-4 md:p-6 text-right font-black text-gray-800 text-sm md:text-base">
                            {(item.quantity * item.unit_price).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-4 md:p-8 bg-white border-t border-gray-200 shrink-0">
                <button
                  onClick={handleFinalizePayment}
                  disabled={isProcessing || selectedOrder.status !== 'ready'}
                  className={`w-full py-5 md:py-8 rounded-2xl md:rounded-3xl font-black text-xl md:text-3xl uppercase tracking-widest flex items-center justify-center gap-4 shadow-2xl transition-all ${
                      selectedOrder.status !== 'ready' 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white shadow-red-900/20'
                  }`}
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={32} /> : 
                   selectedOrder.status !== 'ready' ? 'En préparation...' : <><CreditCard size={32} /> ENCAISSER MAINTENANT</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-6 p-10">
              <div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-inner">
                <Utensils size={80} className="opacity-10" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-black uppercase tracking-widest text-gray-400">Prêt pour l'encaissement</p>
                <p className="text-sm font-bold text-gray-300 uppercase mt-2">Sélectionnez une table à gauche pour commencer</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
