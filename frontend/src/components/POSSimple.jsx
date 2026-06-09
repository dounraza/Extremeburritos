import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Plus, Loader2 } from 'lucide-react';

export default function POSSimple({ session, selectedDepotId }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Use normal join to allow products without stock entries to show up
      let query = supabase
        .from('produits')
        .select(`*, stocks(*)`)
        .order('name');
      const { data } = await query;
      if (data) {
        // Show all products in the simple POS
        const formattedData = data.map(p => ({ 
            ...p, 
            stock_quantity: p.stocks?.find(s => s.depot_id === selectedDepotId)?.quantity || 0 
          }));
        setProducts(formattedData);
        setFilteredProducts(formattedData);
      }
    };
    if (selectedDepotId) fetchData();
  }, [selectedDepotId]);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    setFilteredProducts(term ? products.filter(p => p.name.toLowerCase().includes(term)) : products);
  }, [searchTerm, products]);

  const addToInvoice = (product) => {
    setInvoiceItems(prev => {
        const existingItem = prev.find(item => item.id === product.id);
        if (existingItem) {
            return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        return [...prev, { ...product, item_id: product.id, quantity: 1, unit_price: product.price }];
    });
  };

  const removeItem = (id) => setInvoiceItems(prev => prev.filter(item => item.id !== id));

  const total = useMemo(() => invoiceItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0), [invoiceItems]);

  const handleFinalize = async () => {
    if (invoiceItems.length === 0) return;
    setIsProcessing(true);
    try {
      // 1. Create Invoice
      const { data: invoice, error: invErr } = await supabase.from('factures')
        .insert([{ 
            number: `FAC-SMP-${Date.now().toString().slice(-6)}`, 
            user_id: session?.user?.id, 
            total_amount: total, 
            paid_amount: total,
            status: 'paid',
            depot_id: selectedDepotId,
            guest_name: clientName || 'Client Simple'
        }])
        .select().single();
      if (invErr) throw invErr;

      // 2. Add Items & Update Stock
      for (const item of invoiceItems) {
        await supabase.from('facture_items').insert([{ 
            facture_id: invoice.id, 
            produit_id: item.id, 
            quantity: item.quantity, 
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price 
        }]);

        await supabase.from('stocks').update({ quantity: item.stock_quantity - item.quantity }).eq('product_id', item.id).eq('depot_id', selectedDepotId);
      }
      
      alert('Vente finalisée !');
      setInvoiceItems([]);
      setClientName('');
    } catch (e) {
      alert("Erreur: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <div className="flex gap-4 h-[60vh]">
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-y-auto">
            <h3 className="font-black text-gray-700 uppercase mb-4">Panier</h3>
            <div className="space-y-2">
                {invoiceItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                        <span className="font-bold">{item.name} x {item.quantity}</span>
                        <span className="font-black">{(item.quantity * item.unit_price).toLocaleString()} Ar</span>
                        <button onClick={() => removeItem(item.id)} className="text-red-500"><Trash2 size={16}/></button>
                    </div>
                ))}
            </div>
        </div>
        <div className="w-80 bg-gray-900 text-white p-4 rounded-xl flex flex-col gap-4">
            <input type="text" placeholder="Nom Client" className="bg-gray-800 p-2 rounded text-white" value={clientName} onChange={e => setClientName(e.target.value)} />
            <div className="text-4xl font-black text-red-500 text-center">{total.toLocaleString()} Ar</div>
            <button onClick={handleFinalize} disabled={isProcessing || invoiceItems.length === 0} className="bg-red-600 py-4 font-black rounded-xl">
                {isProcessing ? <Loader2 className="animate-spin mx-auto" /> : 'FINALISER'}
            </button>
        </div>
      </div>
      <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-y-auto">
         <input type="text" placeholder="Rechercher..." className="w-full bg-gray-50 p-2 rounded-lg mb-4" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
         <div className="grid grid-cols-4 gap-2">
            {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addToInvoice(p)} className="bg-gray-100 p-3 rounded-lg text-left hover:bg-red-50 transition-colors">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-sm font-black text-red-600">{p.price.toLocaleString()} Ar</div>
                </button>
            ))}
         </div>
      </div>
    </div>
  );
}
