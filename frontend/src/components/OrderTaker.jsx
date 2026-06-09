import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Send, Loader2, Utensils, Trash2, X } from 'lucide-react';

const TABLES = Array.from({ length: 12 }, (_, i) => `Table ${i + 1}`);

export default function OrderTaker({ session, selectedDepotId }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  const [existingOrderItems, setExistingOrderItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  
  useEffect(() => {
    const fetchExistingOrder = async () => {
      if (!selectedTable) {
        setExistingOrderItems([]);
        return;
      }
      const { data: order } = await supabase
        .from('commandes')
        .select('id')
        .eq('table_name', selectedTable)
        .in('status', ['pending', 'preparing'])
        .maybeSingle();
      
      if (order) {
        const { data: items } = await supabase
          .from('commande_items')
          .select('*, produits(name)')
          .eq('commande_id', order.id);
        
        setExistingOrderItems(items || []);
      } else {
        setExistingOrderItems([]);
      }
    };
    fetchExistingOrder();
  }, [selectedTable]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // 3x4 or 4x3 grid ideal

  useEffect(() => {
    const fetchData = async () => {
      // Fetch Products - Remove '.eq' on stocks to avoid hiding items without stock entry (like cuisine items)
      let { data: productsData } = await supabase
        .from('produits')
        .select(`*, stocks(*)`)
        .order('name');
      
      // Fetch Menus
      let { data: menusData } = await supabase
        .from('menus')
        .select(`*, menu_items(produits(name, price))`)
        .eq('is_active', true);

      let allItems = [];
      if (productsData) {
        // Only show 'vente' type products in the order taker as requested
        allItems = [...allItems, ...productsData
          .filter(p => p.type === 'vente' || !p.type)
          .map(p => ({ 
            ...p, 
            type: 'product',
            type_prod: p.type || 'vente',
            stock_quantity: p.stocks?.find(s => s.depot_id === selectedDepotId)?.quantity || 0 
        }))];
      }
      
      if (menusData) {
        allItems = [...allItems, ...menusData.map(m => ({
            id: m.id,
            name: m.name,
            price: m.price,
            description: m.description,
            type: 'menu',
            stock_quantity: 999 // Menus assumed to have infinite stock for now
        }))];
      }

      setProducts(allItems);
      setFilteredProducts(allItems);
    };
    if (selectedDepotId) fetchData();
  }, [selectedDepotId]);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    const filtered = term ? products.filter(p => p.name.toLowerCase().includes(term)) : products;
    setFilteredProducts(filtered);
    setCurrentPage(1); // Reset to page 1 on new search
  }, [searchTerm, products]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = useMemo(() => cart.reduce((acc, item) => acc + (item.quantity * item.price), 0), [cart]);

  const handleSendToKitchen = async () => {
    if (!selectedTable || cart.length === 0) return;
    setIsProcessing(true);
    try {
      // 1. Check for existing pending/preparing order for this table
      const { data: existingOrder } = await supabase
        .from('commandes')
        .select('id, total_amount')
        .eq('table_name', selectedTable)
        .in('status', ['pending', 'preparing'])
        .maybeSingle();

      let commandeId;
      let newTotal;

      if (existingOrder) {
        commandeId = existingOrder.id;
        newTotal = Number(existingOrder.total_amount) + total;
        
        // Update existing command total
        await supabase
          .from('commandes')
          .update({ total_amount: newTotal })
          .eq('id', commandeId);
      } else {
        // 2. Create new command if none exists
        const { data: commande, error: cmdErr } = await supabase
          .from('commandes')
          .insert([{ 
              table_name: selectedTable, 
              total_amount: total, 
              status: 'pending',
              user_id: session?.user?.id
          }])
          .select().single();
        
        if (cmdErr) throw cmdErr;
        commandeId = commande.id;
        
        // Create corresponding invoice (only for new orders)
        await supabase.from('factures').insert([{ 
            commande_id: commandeId,
            number: `ORD-${Date.now().toString().slice(-6)}`, 
            user_id: session?.user?.id, 
            total_amount: total, 
            paid_amount: 0,
            status: 'unpaid',
            depot_id: selectedDepotId,
            guest_name: selectedTable
        }]);
      }

      // 3. Insert items into commande_items
      const itemsToInsert = cart.map(item => ({
        commande_id: commandeId,
        item_id: item.id,
        item_type: item.type || 'product',
        quantity: item.quantity,
        unit_price: item.price
      }));

      const { error: itemsErr } = await supabase.from('commande_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      alert(`Commande mise à jour pour la ${selectedTable} !`);
      setCart([]);
      setSelectedTable(null);
      setShowCartMobile(false);
    } catch (e) {
      alert("Erreur: " + e.message);
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative selection:bg-red-200">
      <div className="flex flex-col lg:flex-row h-full overflow-hidden">
        
        {/* Main Content: Tables & Products */}
        <div className="flex-1 flex flex-col min-h-0 p-2 md:p-4 gap-2 md:gap-4 overflow-hidden">
          {/* Table Selection - Dropdown */}
          <div className="bg-white p-3 md:p-5 rounded-[2rem] shadow-sm border border-gray-200 shrink-0">
            <h3 className="font-black text-gray-400 uppercase mb-3 flex items-center gap-2 text-[10px] tracking-[0.2em]">
              <Utensils size={14} className="text-red-600" /> Sélection Table
            </h3>
            <select 
              value={selectedTable || ""}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full p-4 md:p-5 bg-gray-50 rounded-2xl font-black text-lg md:text-xl text-gray-800 outline-none border-2 border-transparent focus:border-red-500 focus:bg-white transition-all appearance-none"
            >
              <option value="" disabled>Choisir une table...</option>
              {TABLES.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 bg-white p-3 md:p-5 rounded-[2rem] shadow-sm border border-gray-200 flex flex-col min-h-0 overflow-hidden">
            
            {/* Cart Summary Header */}
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowCartMobile(true)}
                className="lg:hidden flex-1 bg-gray-900 text-white p-5 rounded-[1.5rem] flex items-center justify-between shadow-xl active:scale-95 transition-all border-l-8 border-red-600"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <ShoppingCart size={24} />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Table {selectedTable ? selectedTable.replace('Table ', '') : '?'}</p>
                    <p className="font-black text-lg text-red-500">{total.toLocaleString()} Ar</p>
                  </div>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl font-black text-xs uppercase">
                  Voir Panier ({cart.reduce((a, b) => a + b.quantity, 0)})
                </div>
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Recherche rapide..." 
                className="w-full pl-12 pr-4 py-4 md:py-6 bg-gray-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-red-500 focus:bg-white transition-all text-lg md:text-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Scrollable grid - Optimized for touch scrolling */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 content-start pb-4">
              {paginatedProducts.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className={`p-4 md:p-6 rounded-[1.5rem] text-left transition-all border-2 border-transparent active:scale-[0.98] flex flex-col justify-between h-32 md:h-40 group shadow-sm ${p.type === 'menu' ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-black uppercase text-xs md:text-base leading-tight line-clamp-2">{p.name}</div>
                    <div className="flex flex-col items-end gap-1">
                      {p.type === 'menu' && <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase">Menu</span>}
                      {p.type === 'product' && p.type_prod === 'cuisine' && <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Cuisine</span>}
                      {p.type === 'product' && p.type_prod === 'vente' && <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Vente</span>}
                    </div>
                  </div>
                  <div className="mt-2 font-black text-lg md:text-2xl text-red-600">{p.price.toLocaleString()} <span className="text-[10px] md:text-xs">Ar</span></div>
                </button>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100 shrink-0">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-6 py-3 bg-gray-100 rounded-xl font-black text-xs uppercase text-gray-500 disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all"
                >
                  Précédent
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Page</span>
                  <span className="w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-lg shadow-red-200">{currentPage}</span>
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">sur {totalPages}</span>
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Cart - Desktop (LG and up) */}
        <div className="hidden lg:flex w-80 xl:w-96 bg-gray-900 text-white p-4 flex-col shadow-xl border-l border-gray-800">
          <CartContent 
            selectedTable={selectedTable} 
            cart={cart}
            existingOrderItems={existingOrderItems}
            removeFromCart={removeFromCart} 
            updateQuantity={updateQuantity}
            total={total} 
            handleSendToKitchen={handleSendToKitchen} 
            isProcessing={isProcessing} 
          />
        </div>

        {/* Floating Action Button - Visible only when cart has items OR on small screens */}
        <div className="lg:hidden fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-3">
          {cart.length > 0 && (
             <div className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl font-black text-sm border-2 border-red-600 animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3">
                <span className="text-red-500">{total.toLocaleString()} Ar</span>
                <div className="w-px h-4 bg-gray-700"></div>
                <span>{cart.reduce((a, b) => a + b.quantity, 0)} articles</span>
             </div>
          )}
          <button 
            onClick={() => setShowCartMobile(true)}
            className="w-20 h-20 bg-red-600 text-white rounded-full shadow-[0_20px_50px_rgba(220,38,38,0.5)] flex items-center justify-center active:scale-90 transition-all border-4 border-white"
          >
            <div className="relative">
              <ShoppingCart size={32} />
              {cart.length > 0 && (
                <span className="absolute -top-3 -right-3 bg-gray-900 text-white text-xs font-black min-w-[24px] h-6 px-1 rounded-full flex items-center justify-center border-2 border-white">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Cart Drawer - Ensuring high z-index and clear overlay */}
        {showCartMobile && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
              onClick={() => setShowCartMobile(false)}
            ></div>
            
            {/* Drawer Content */}
            <div className="relative w-[90%] sm:w-[400px] bg-gray-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-white/10 flex items-center justify-between text-white shrink-0">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black uppercase flex items-center gap-3 text-red-500">
                    <ShoppingCart size={24} /> Votre Panier
                  </h3>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Table: {selectedTable || 'Non définie'}</span>
                </div>
                <button 
                  onClick={() => setShowCartMobile(false)} 
                  className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                >
                  <X size={32} />
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <div className="h-full p-4">
                   <CartContent 
                    selectedTable={selectedTable} 
                    cart={cart} 
                    existingOrderItems={existingOrderItems}
                    removeFromCart={removeFromCart} 
                    updateQuantity={updateQuantity}
                    total={total} 
                    handleSendToKitchen={handleSendToKitchen} 
                    isProcessing={isProcessing} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CartContent({ selectedTable, cart, existingOrderItems, removeFromCart, updateQuantity, total, handleSendToKitchen, isProcessing }) {
  return (
    <div className="flex flex-col h-full text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Emplacement</span>
          <span className="text-xl font-black text-red-500 uppercase">{selectedTable || 'À Définir'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {existingOrderItems.length > 0 && (
          <div className="mb-4">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Déjà commandé</h4>
            {existingOrderItems.map(item => (
              <div key={item.id} className="bg-white/5 p-3 rounded-2xl border border-white/5 opacity-70 flex justify-between items-center text-sm">
                <span className="font-bold">{item.produits?.name || 'Article'}</span>
                <span className="font-black">x{item.quantity}</span>
              </div>
            ))}
          </div>
        )}

        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Nouveau</h4>
        {cart.map(item => (
          <div key={item.id} className="bg-white/5 p-4 rounded-2xl border border-white/10 group animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="font-black text-sm uppercase leading-tight flex-1 pr-2">{item.name}</span>
              <button 
                onClick={() => removeFromCart(item.id)}
                className="text-gray-500 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4 bg-black/30 rounded-xl p-1 px-2">
                <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center font-black text-xl hover:text-red-500">-</button>
                <span className="font-black text-lg w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center font-black text-xl hover:text-red-500">+</button>
              </div>
              <span className="text-sm text-gray-400 font-black">{(item.quantity * item.price).toLocaleString()} Ar</span>
            </div>
          </div>
        ))}
        {cart.length === 0 && existingOrderItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center p-8 opacity-40">
            <Utensils size={60} className="mb-4" />
            <p className="font-black uppercase tracking-widest text-xs leading-loose">Sélectionnez une table<br />et ajoutez des plats</p>
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-white/10">
        <div className="flex justify-between items-end mb-6">
          <span className="text-gray-400 font-bold uppercase text-xs">Total Nouveaux</span>
          <span className="text-4xl font-black text-red-500 tracking-tighter">{total.toLocaleString()} <span className="text-sm uppercase ml-1">Ar</span></span>
        </div>
        <button 
          onClick={handleSendToKitchen}
          disabled={isProcessing || cart.length === 0 || !selectedTable}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-600 py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-red-900/30 active:scale-[0.98]"
        >
          {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <><Send size={20} /> ENVOYER EN CUISINE</>}
        </button>
      </div>
    </div>
  );
}
