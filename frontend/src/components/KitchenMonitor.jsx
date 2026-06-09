import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle2, Loader2, Utensils, AlertCircle, Trash2 } from 'lucide-react';

export default function KitchenMonitor({ session }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    // 1. Fetch commands and items without joining 'produits' automatically
    const { data, error } = await supabase
      .from('commandes')
      .select(`
        id, 
        table_name, 
        status, 
        created_at,
        commande_items (*)
      `)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching kitchen orders:", error);
      setLoading(false);
      return;
    }

    // 2. Manually enrich items with product or menu names
    const ordersWithProducts = await Promise.all((data || []).map(async (order) => {
        const itemsWithNames = await Promise.all(order.commande_items.map(async (item) => {
            if (item.item_type === 'product') {
                const { data: prodData } = await supabase
                    .from('produits')
                    .select('name')
                    .eq('id', item.item_id)
                    .single();
                return { ...item, produits: prodData };
            } else if (item.item_type === 'menu') {
                const { data: menuData } = await supabase
                    .from('menus')
                    .select('name')
                    .eq('id', item.item_id)
                    .single();
                return { ...item, produits: menuData };
            }
            return { ...item, produits: { name: 'Article Inconnu' } };
        }));
        return { ...order, commande_items: itemsWithNames };
    }));

    setOrders(ordersWithProducts);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to changes on 'commandes'
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'commandes' 
      }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    // If cancelling, we need to find items to restock first
    if (newStatus === 'cancelled') {
        const { data: orderData } = await supabase
            .from('commandes')
            .select('commande_items(item_id, item_type, quantity)')
            .eq('id', orderId)
            .single();

        if (orderData && orderData.commande_items) {
            for (const item of orderData.commande_items) {
                if (item.item_type === 'product') {
                    // Fetch current stock
                    const { data: stockData } = await supabase
                        .from('stocks')
                        .select('id, quantity')
                        .eq('product_id', item.item_id)
                        .maybeSingle();

                    if (stockData) {
                        await supabase
                            .from('stocks')
                            .update({ quantity: Number(stockData.quantity) + Number(item.quantity) })
                            .eq('id', stockData.id);
                    }
                }
            }
        }
    }

    const { error } = await supabase
      .from('commandes')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert("Erreur lors de la mise à jour : " + error.message);
    } else {
        // Refresh orders immediately
        fetchOrders();
        
        // Notification toast (simple version)
        const message = newStatus === 'cancelled' ? "Commande annulée !" : "Commande prête !";
        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 right-5 px-6 py-4 rounded-2xl font-black text-white shadow-2xl z-50 ${newStatus === 'cancelled' ? 'bg-gray-800' : 'bg-green-600'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
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
    <div className="h-full bg-gray-100 flex flex-col overflow-hidden">
      <div className="p-4 md:p-6 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl md:text-3xl font-black text-gray-800 uppercase flex items-center gap-3">
          <Utensils size={32} className="text-red-600" /> Moniteur Cuisine
        </h2>
        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-bold text-gray-600 uppercase text-[10px] md:text-xs">Temps Réel Actif</span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4 md:p-6 pt-0">
        <div className="grid grid-cols-1 gap-6 h-full min-h-0">
          {/* TO PREPARE */}
          <div className="flex flex-col gap-4 min-h-0">
            <div className="bg-orange-500 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between shrink-0">
              <span className="font-black uppercase tracking-wider text-sm md:text-base">À Préparer</span>
              <span className="bg-white/20 px-3 py-1 rounded-full font-black text-sm">
                {orders.filter(o => o.status === 'pending').length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar">
              {orders.filter(o => o.status === 'pending').map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  onAction={() => updateStatus(order.id, 'ready')} 
                  onCancel={() => updateStatus(order.id, 'cancelled')}
                  actionLabel="Prêt !" 
                  actionColor="bg-green-600" 
                />
              ))}
              {orders.filter(o => o.status === 'pending').length === 0 && <EmptyState label="Aucune nouvelle commande" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAction, actionLabel, actionColor, onCancel }) {
  const timeElapsed = Math.floor((new Date() - new Date(order.created_at)) / 60000);
  const [loadingAction, setLoadingAction] = useState(null);

  const handleAction = async (actionFn) => {
    setLoadingAction(actionFn === onCancel ? 'cancel' : 'ready');
    await actionFn();
    setLoadingAction(null);
  };

  const removeItem = async (item, order) => {
    setLoadingAction(`remove-${item.id}`);
    try {
      // 1. Reintegrate stock if it's a product
      if (item.item_type === 'product') {
        const { data: stockData } = await supabase
          .from('stocks')
          .select('id, quantity')
          .eq('product_id', item.item_id)
          .maybeSingle();

        if (stockData) {
          await supabase
            .from('stocks')
            .update({ quantity: Number(stockData.quantity) + Number(item.quantity) })
            .eq('id', stockData.id);
        }
      }

      // 2. Remove item
      await supabase.from('commande_items').delete().eq('id', item.id);
      
      // 3. Update Order Total
      const { data: latestOrder, error: fetchErr } = await supabase
        .from('commandes')
        .select('total_amount')
        .eq('id', order.id)
        .single();
      
      if (!fetchErr && latestOrder) {
        const newTotal = Number(latestOrder.total_amount) - (Number(item.quantity) * Number(item.unit_price));
        await supabase
          .from('commandes')
          .update({ total_amount: newTotal })
          .eq('id', order.id);
      }
      
      // Note: We don't need to manually refresh the list here, the subscription will handle it.
    } catch (e) {
      alert("Erreur lors de la suppression : " + e.message);
    } finally {
      setLoadingAction(null);
    }
  };
  
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 flex flex-col min-h-[250px] animate-in fade-in slide-in-from-bottom-2 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
        <div>
          <div className="text-2xl font-black text-gray-900 leading-none mb-1">{order.table_name}</div>
        </div>
        <div className={`flex items-center gap-1 font-black text-xs px-2 py-1 rounded-full ${timeElapsed > 15 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
          <Clock size={12} /> {timeElapsed} min
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto max-h-[300px]">
        <div className="space-y-3">
          {order.commande_items?.map(item => (
            <div key={item.id} className="flex justify-between items-center gap-4">
              <span className="font-bold text-gray-700 uppercase text-sm leading-tight flex-1">
                {item.produits?.name || 'Menu/Article'}
              </span>
              <div className="flex items-center gap-2">
                <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs font-black shrink-0">
                  x{item.quantity}
                </span>
                <button
                    onClick={() => removeItem(item, order)}
                    disabled={loadingAction === `remove-${item.id}`}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                >
                    {loadingAction === `remove-${item.id}` ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
          {(!order.commande_items || order.commande_items.length === 0) && (
             <p className="text-xs text-gray-400 italic">Aucun article trouvé</p>
          )}
        </div>
      </div>

      <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <button 
          onClick={() => handleAction(onCancel)}
          disabled={loadingAction !== null}
          className="w-1/3 bg-gray-200 text-gray-700 py-4 rounded-xl font-black uppercase tracking-widest shadow-md active:scale-[0.98] transition-all text-xs flex items-center justify-center"
        >
          {loadingAction === 'cancel' ? <Loader2 className="animate-spin" size={18} /> : 'Annuler'}
        </button>
        <button 
          onClick={() => handleAction(onAction)}
          disabled={loadingAction !== null}
          className={`w-2/3 ${actionColor} text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-md active:scale-[0.98] transition-all text-xs flex items-center justify-center`}
        >
          {loadingAction === 'ready' ? <Loader2 className="animate-spin" size={18} /> : actionLabel}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="h-32 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 gap-2">
      <AlertCircle size={24} />
      <span className="font-bold uppercase text-xs">{label}</span>
    </div>
  );
}
