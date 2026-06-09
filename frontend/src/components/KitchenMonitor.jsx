import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle2, Loader2, Utensils, AlertCircle, Trash2, X, Bell } from 'lucide-react';

export default function KitchenMonitor({ session }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('commandes')
      .select(`
        id, 
        table_name, 
        status, 
        created_at,
        order_reference,
        commande_items (*)
      `)
      .in('status', ['pending', 'preparing'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching kitchen orders:", error);
      setLoading(false);
      return;
    }

    const groupedOrders = {};
    (data || []).forEach(order => {
        if (!groupedOrders[order.table_name]) {
            groupedOrders[order.table_name] = { ...order, commande_items: [...order.commande_items] };
        } else {
            groupedOrders[order.table_name].commande_items.push(...order.commande_items);
        }
    });

    const ordersWithProducts = await Promise.all(Object.values(groupedOrders).map(async (order) => {
        const itemsWithNames = await Promise.all(order.commande_items.map(async (item) => {
            const baseItem = { ...item };
            if (item.item_type === 'product' && item.item_id) {
                const { data: prodData } = await supabase
                    .from('produits')
                    .select('name, type')
                    .eq('id', item.item_id)
                    .maybeSingle();
                return { ...baseItem, produits: prodData || { name: 'Produit inconnu' } };
            } else if (item.item_type === 'menu') {
                const { data: menuData } = await supabase
                    .from('menus')
                    .select('name')
                    .eq('id', item.item_id)
                    .maybeSingle();
                return { ...baseItem, produits: { ...menuData, type: 'cuisine' } };
            }
            return { ...baseItem, produits: { name: 'Article Inconnu' } };
        }));
        return { ...order, commande_items: itemsWithNames };
    }));

    setOrders(ordersWithProducts);
    setLoading(false);
  };
  
  const filteredOrders = orders.filter(o => o.table_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, fetchOrders)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const updateStatus = async (orderReference, newStatus) => {
    if (newStatus === 'cancelled') {
        const { data: orderData } = await supabase
            .from('commandes')
            .select('commande_items(item_id, item_type, quantity)')
            .eq('order_reference', orderReference)
            .single();

        if (orderData && orderData.commande_items) {
            for (const item of orderData.commande_items) {
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
            }
        }
    }

    const { error } = await supabase
      .from('commandes')
      .update({ status: newStatus })
      .eq('order_reference', orderReference);

    if (error) {
      alert("Erreur lors de la mise à jour : " + error.message);
    } else {
        const message = newStatus === 'cancelled' ? "Commande annulée !" : "Commande prête !";
        const toast = document.createElement('div');
        toast.className = `fixed top-5 right-5 px-8 py-5 rounded-[2rem] font-black text-white shadow-2xl z-[200] animate-in slide-in-from-top-4 duration-300 ${newStatus === 'cancelled' ? 'bg-gray-900 border-2 border-white/10' : 'bg-emerald-600 border-4 border-emerald-500 shadow-emerald-500/40'}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
            fetchOrders();
        }, 2500);
    }
  };

  function OrderCard({ order, onAction, actionLabel, actionColor, onCancel }) {
    const timeElapsed = Math.floor((new Date() - new Date(order.created_at)) / 60000);
    const [loadingAction, setLoadingAction] = useState(null);

    const handleAction = async (actionFn) => {
        setLoadingAction(actionFn === onCancel ? 'cancel' : 'ready');
        await actionFn();
        setLoadingAction(null);
    };
    
    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col min-h-[350px] transition-all hover:shadow-lg hover:border-red-100 overflow-hidden">
        
        {/* Card Header */}
        <div className={`p-5 flex justify-between items-start ${timeElapsed > 15 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div>
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">Table</span>
            <div className="text-2xl font-black text-gray-900 leading-none tracking-tighter uppercase">{order.table_name}</div>
            </div>
            <div className={`flex items-center gap-1.5 font-black text-[10px] px-3 py-1 rounded-full ${
            timeElapsed > 15 ? 'bg-red-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}>
            <Clock size={12} /> {timeElapsed} min
            </div>
        </div>

        {/* Card Items */}
        <div className="flex-1 p-5 space-y-3 overflow-y-auto no-scrollbar">
            {order.commande_items?.map(item => (
            <div key={item.id} className={`flex justify-between items-center gap-3 p-3 rounded-xl border ${item.is_additional ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-50'}`}>
                <div className="flex flex-col">
                <span className="font-bold text-gray-800 text-xs uppercase tracking-tight">
                    {item.produits?.name || 'Menu'}
                </span>
                {item.is_additional && (
                    <span className="text-[8px] font-black text-orange-600 uppercase mt-0.5">Ajout</span>
                )}
                </div>
                <span className="bg-gray-900 text-white px-2 py-1 rounded-lg font-black text-[10px]">x{item.quantity}</span>
            </div>
            ))}
        </div>

        {/* Card Footer */}
        <div className="p-4 grid grid-cols-2 gap-3 shrink-0">
            <button 
                onClick={() => handleAction(onCancel)}
                disabled={loadingAction !== null}
                className="bg-gray-100 hover:bg-gray-200 text-gray-500 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-colors flex items-center justify-center gap-2"
            >
                {loadingAction === 'cancel' ? <Loader2 className="animate-spin" size={14} /> : (
                    <span className="group-hover:scale-110 transition-transform">Annuler</span>
                )}
            </button>
            <button 
            onClick={() => handleAction(onAction)}
            disabled={loadingAction !== null}
            className={`${actionColor} hover:brightness-105 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 transition-all`}
            >
            {loadingAction === 'ready' ? <Loader2 className="animate-spin" size={14} /> : (
                <>
                <CheckCircle2 size={14} />
                {actionLabel}
                </>
            )}
            </button>
        </div>
        </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden font-sans">
      <header className="bg-white border-b border-gray-100 p-6 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-red-600 to-red-700 p-3 rounded-2xl shadow-lg shadow-red-200">
            <Utensils size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">Cuisine Station</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Flux de préparation en temps réel</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Rechercher une table..." 
            className="px-4 py-2 bg-gray-50 rounded-full border border-gray-200 text-sm font-bold outline-none focus:border-red-500 transition-all"
            value={searchTerm}
            onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
          />
          <div className="text-right">
             <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">En attente</span>
             <span className="text-2xl font-black text-red-600">{orders.filter(o => o.status === 'pending').length}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
          {paginatedOrders.map(order => (
            <OrderCard 
              key={order.order_reference} 
              order={order} 
              onAction={() => updateStatus(order.order_reference, 'ready')} 
              onCancel={() => updateStatus(order.order_reference, 'cancelled')}
              actionLabel="TERMINER" 
              actionColor="bg-emerald-600" 
            />
          ))}
          {filteredOrders.length === 0 && (
            <div className="col-span-full h-96 flex flex-col items-center justify-center text-gray-300 gap-4">
              <Bell size={48} className="opacity-20" />
              <p className="font-black uppercase tracking-[0.2em] text-[10px] text-gray-400">Aucune commande trouvée</p>
            </div>
          )}
        </div>
      </main>
      
      {totalPages > 1 && (
        <footer className="p-4 bg-white border-t border-gray-100 flex justify-center items-center gap-4">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-6 py-2 bg-gray-100 rounded-full font-bold text-xs disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="font-black text-sm">Page {currentPage} / {totalPages}</span>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-6 py-2 bg-gray-100 rounded-full font-bold text-xs disabled:opacity-50"
          >
            Suivant
          </button>
        </footer>
      )}
    </div>
  );
}
