import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Search, ShoppingCart, Trash2, Package, CheckCircle, Loader2, Plus, Minus, Tag, Send } from 'lucide-react';
import Calculator from './Calculator';
import confetti from 'canvas-confetti';

export default function POS({ session, selectedDepotId }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discountModal, setDiscountModal] = useState(null);
  const [activeItemId, setActiveItemId] = useState(null);
  const [paymentMode, setPaymentMode] = useState('cash'); 
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditType, setCreditType] = useState('mensuel');
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminAuthCode, setAdminAuthCode] = useState('');
  const [dbAdminCode, setDbAdminCode] = useState(null); // No fallback

  useEffect(() => {
    const fetchAdminCode = async () => {
        const { data, error } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'admin_code')
            .single();
        if (error) {
            console.error("Erreur récupération code admin :", error);
        } else if (data) {
            setDbAdminCode(data.value);
        }
    };
    fetchAdminCode();
  }, []);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState({ value: 0, type: '%' });
  const [printInvoice, setPrintInvoice] = useState(true);
  const [showPreview, setShowPreview] = useState(false); // New state to control preview vs direct print
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [isOther, setIsOther] = useState(false);
  const [calculatorPos, setCalculatorPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [previewDeliveryNote, setPreviewDeliveryNote] = useState(null); // NEW
  const [printFormat, setPrintFormat] = useState('auto'); // 'auto', 'A4', or 'ticket'

  // Helper to get effective format
  const getEffectiveFormat = () => {
    if (printFormat !== 'auto') return printFormat;
    return previewInvoice?.type === 'CRÉDIT' ? 'A4' : 'ticket';
  };

  const effectiveFormat = getEffectiveFormat();
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [tokens, setTokens] = useState([]);
  const [pendingProductIds, setPendingProductIds] = useState(new Set());
  const [currentDepotInfo, setCurrentDepotInfo] = useState(null); 
  const itemsPerPage = 15;

  const formatQuantity = (quantity, product) => {
    if (!product || !product.quantite_par_unite) return `${quantity} ${product?.unite_base || 'Pce'}`;
    const qpu = Number(product.quantite_par_unite);
    if (qpu <= 1) return `${quantity} ${product.unite_base || 'Pce'}`;
    
    const superior = Math.floor(quantity / qpu);
    const base = quantity % qpu;
    
    let result = '';
    if (superior > 0) result += `${superior} ${product.unite_superieure || 'Sac'} `;
    if (base > 0) result += `+ ${base} ${product.unite_base || 'Kg'}`;
    
    return result.trim() || `${quantity} ${product.unite_base}`;
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - calculatorPos.x, y: e.clientY - calculatorPos.y };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setCalculatorPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleCalculatorResult = (quantity, addedTotal) => {
    // console.log("POS - handleCalculatorResult received:", { quantity, addedTotal });
    if (activeItemId) {
        updateItem(activeItemId, quantity, addedTotal);
        setIsCalculatorOpen(false);
    }
  };

  const updateItem = async (itemId, quantity, totalAmount) => {

    // console.log("POS - updateItem called:", { itemId, quantity, totalAmount });
    if (quantity < 0) quantity = 0;

    setInvoiceItems(prevItems => {
        const updatedItems = prevItems.map(item =>
            item.item_id === itemId ? {
                ...item,
                quantity: quantity,
                total: (item.total || 0) + totalAmount
            } : item
        );
        console.log("POS - Updated invoiceItems:", updatedItems);
        return updatedItems;
    });

    // We also need the current total to update Supabase correctly if we are accumulating
    const { data: currentItem } = await supabase.from('facture_items').select('total').eq('id', itemId).single();
    const newTotal = (currentItem?.total || 0) + totalAmount;

    await supabase.from('facture_items').update({ quantity: quantity, total: newTotal }).eq('id', itemId);
  };
  const handleReset = async () => {
    if (!activeInvoice || invoiceItems.length === 0) return;
    if (!window.confirm("Êtes-vous sûr de vouloir réinitialiser cette commande ?")) return;

    setIsProcessing(true);
    try {
      await supabase.from('facture_items').delete().eq('facture_id', activeInvoice.id);
      const updates = { total_amount: 0, paid_amount: 0, payment_mode: 'cash' };
      await supabase.from('factures').update(updates).eq('id', activeInvoice.id);
      setInvoiceItems([]);
      setActiveInvoice({ ...activeInvoice, ...updates });
      setPaymentMode('cash');
      setAdvanceAmount(0);
      setSearchTerm('');
      setGlobalDiscount({ value: 0, type: '%' });
      setActiveItemId(null);
      setDiscountModal(null);
      setIsCalculatorOpen(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const addToInvoice = async (product) => {
    if (pendingProductIds.has(product.id)) return;
    setPendingProductIds(prev => new Set(prev).add(product.id));

    try {
        let currentInvoice = activeInvoice;
        if (!currentInvoice || currentInvoice.number === 'TEMP') {
            const { data, error } = await supabase.from('factures')
                .insert([{ number: `FAC-${Date.now().toString().slice(-6)}`, user_id: session?.user?.id, created_at: new Date().toISOString() }])
                .select()
                .single();
            if (error) return alert("Erreur de création de facture.");
            currentInvoice = data;
            setActiveInvoice(data);
        }

        // Check if product is already in the invoice by product.id
        const existingItem = invoiceItems.find(item => item.id === product.id);
        if (existingItem) {
            // If it exists, just open the calculator for the existing item_id
            setActiveItemId(existingItem.item_id);
            setIsCalculatorOpen(true);
        } else {
            const { data, error } = await supabase.from('facture_items')
                .insert([{ facture_id: currentInvoice.id, produit_id: product.id, quantity: 0, unit_price: product.price }])
                .select()
                .single();
            if (data) {
                console.log("POS - Item added to invoiceItems:", { ...product, item_id: data.id, quantity: 0, unit_price: product.price });
                setInvoiceItems(prev => [...prev, { ...product, item_id: data.id, quantity: 0, unit_price: product.price, discount: null }]);
                setActiveItemId(data.id);
                setIsCalculatorOpen(true);
            }
        }
    } finally {
        setPendingProductIds(prev => {
            const next = new Set(prev);
            next.delete(product.id);
            return next;
        });
    }
  };

  function calculateItemTotal(item) {
    const q = Number(item.quantity) || 0;
    const qpu = Number(item.quantite_par_unite) || 1;
    const priceSup = Number(item.price_superior) || 0;
    const priceBase = Number(item.unit_price) || 0;

    let baseTotal = 0;
    if (qpu > 1 && priceSup > 0) {
        const superior = Math.floor(q / qpu);
        const base = q % qpu;
        baseTotal = (superior * priceSup) + (base * priceBase);
    } else {
        baseTotal = q * priceBase;
    }

    if (!item.discount) return baseTotal;
    const disc = parseFloat(item.discount.value) || 0;
    return item.discount.type === '%' ? baseTotal - (baseTotal * (disc / 100)) : baseTotal - disc;
  }

  const updateInvoiceGuestInfo = (field, value) => setActiveInvoice(prev => ({ ...prev, [field]: value }));
  const removeItem = async (itemId, supabaseItemId) => {
    setInvoiceItems(prev => prev.filter(item => item.item_id !== itemId));
    if (supabaseItemId) await supabase.from('facture_items').delete().eq('id', supabaseItemId);
  };

  const applyDiscount = async (itemId, type, value) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) return alert("Valeur invalide.");
    if (itemId === 'global') {
        setGlobalDiscount({ value: numericValue, type: type });
        setDiscountModal(null);
    } else {
        setInvoiceItems(prev => prev.map(item => item.item_id === itemId ? { ...item, discount: { value: numericValue, type: type } } : item));
        await supabase.from('facture_items').update({ discount_value: numericValue, discount_type: type }).eq('id', itemId);
        setDiscountModal(null);
    }
  };

  const handleFinalize = async () => {
    console.log("Finalize started. Active Invoice:", activeInvoice);
    if (!activeInvoice || invoiceItems.length === 0) {
        console.warn("No invoice or items");
        return;
    }
    
    // Check stock for all items first
    for (const item of invoiceItems) {
        const { data: stockData } = await supabase
            .from('stocks')
            .select('quantity')
            .eq('product_id', item.id)
            .eq('depot_id', selectedDepotId)
            .maybeSingle();
            
        if (!stockData || stockData.quantity < item.quantity) {
            alert(`Stock insuffisant pour : ${item.name}. Disponible: ${stockData?.quantity || 0}`);
            return;
        }
    }

    setIsProcessing(true);
    try {
      console.log("Processing payment...");
      const total = netTotal;
      const advance = paymentMode === 'credit' ? parseFloat(advanceAmount) || 0 : 0;
      // 1. Handle Client Creation
      let clientId = null;
      if (clientName && clientPhone) {
        // Try to find existing
        const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('phone', clientPhone)
            .maybeSingle();

        if (existingClient) {
            clientId = existingClient.id;
        } else {
            // Create new
            const { data: newClient, error: clientError } = await supabase
                .from('clients')
                .insert([{ 
                    name: clientName, 
                    phone: clientPhone, 
                    email: clientEmail, 
                    address: clientAddress,
                    user_id: session?.user?.id 
                }])
                .select('id')
                .single();
            if (clientError) {
                console.error("Error creating client:", clientError);
            } else if (newClient) {
                clientId = newClient.id;
            }
        }
      }

      // 2. Update the invoice
      const { data: updatedInvoice, error: updateError } = await supabase.from('factures').update({
        total_amount: total,
        paid_amount: total - advance,
        type: paymentMode === 'credit' ? 'CRÉDIT' : 'COMPTANT',
        frequency: paymentMode === 'credit' ? creditType : null,
        due_date: paymentMode === 'credit' ? dueDate : new Date().toISOString().split('T')[0],
        advance_amount: advance,
        status: 'paid',
        depot_id: selectedDepotId,
        client_id: clientId, // Link to client table
        guest_name: clientName,
        guest_contact: clientPhone
      }).eq('id', activeInvoice.id).select().single();

      if (updateError) {
        console.error("Update invoice error:", updateError);
        throw updateError;
      }
      console.log("Invoice updated.");

      if (paymentMode === 'credit') {
        // Enregistrer l'échéance principale
        const { error: echeanceError } = await supabase.from('echeances_details').insert([{ 
            facture_id: activeInvoice.id, 
            date_echeance: dueDate, 
            montant: total - advance, 
            statut: 'non_paye' 
        }]);
        if (echeanceError) {
            console.error("Echeance error:", echeanceError);
            throw echeanceError;
        }

        // Si une avance est versée, enregistrer le paiement d'avance
        if (advance > 0) {
            const { error: paiementError } = await supabase.from('paiements').insert([{
                facture_id: activeInvoice.id,
                montant: advance,
                type_paiement: 'avance',
                date_paiement: new Date().toISOString()
            }]);
            if (paiementError) {
                console.error("Paiement avance error:", paiementError);
                throw paiementError;
            }
        }
      }
      
      // Mise à jour explicite et forcée de chaque item dans facture_items
      console.log("Finalize - Syncing items:", invoiceItems);
      for (const item of invoiceItems) {
        const { error: updateItemError } = await supabase
          .from('facture_items')
          .update({ 
            quantity: Number(item.quantity), 
            total: Number(item.total || calculateItemTotal(item)) 
          })
          .eq('id', item.item_id);
          
        if (updateItemError) {
            console.error(`Error syncing item ${item.item_id}:`, updateItemError);
            throw updateItemError;
        }
      }

      // 3. Enregistrer les remises dans la table dédiée
      console.log("Saving discounts...");
      const now = new Date();
      const current_date = now.toISOString().split('T')[0];
      const current_month = now.getMonth() + 1;
      const current_year = now.getFullYear();

      // a. Remises par produit
      for (const item of invoiceItems) {
        if (item.discount && item.discount.value > 0) {
          const lineBrut = Number(item.quantity) * Number(item.unit_price);
          const montantCalcule = item.discount.type === '%' 
            ? (lineBrut * (Number(item.discount.value) / 100)) 
            : Number(item.discount.value);

          await supabase.from('remises').insert([{
            facture_id: activeInvoice.id,
            facture_number: updatedInvoice.number,
            produit_id: item.id,
            facture_item_id: item.item_id,
            type_remise: 'produit',
            valeur: Number(item.discount.value),
            type_valeur: item.discount.type,
            montant_calcule: montantCalcule,
            user_id: session?.user?.id,
            date: current_date,
            month: current_month,
            year: current_year
          }]);
        }
      }

      // b. Remise globale
      if (globalDiscount.value > 0) {
        await supabase.from('remises').insert([{
          facture_id: activeInvoice.id,
          facture_number: updatedInvoice.number,
          type_remise: 'global',
          valeur: Number(globalDiscount.value),
          type_valeur: globalDiscount.type,
          montant_calcule: globalDiscountAmount,
          user_id: session?.user?.id,
          date: current_date,
          month: current_month,
          year: current_year
        }]);
      }

      // --- NEW: Handle B.Enlèvement (Withdrawal) & B.Livraison (Other) ---
      let generatedDN = null;
      if (isWithdrawal || isOther) {
          const type = isWithdrawal ? 'bon_enlevement' : 'bon_livraison';
          const { data: dn, error: dnError } = await supabase
            .from('delivery_notes')
            .insert([{
                bl_number: `BL-${type.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
                total_amount: netTotal,
                user_id: session?.user?.id,
                type: 'out' // Mark as outbound
            }])
            .select()
            .single();

          if (dnError) throw dnError;
          generatedDN = dn;

          for (const item of invoiceItems) {
              await supabase.from('delivery_note_items').insert([{
                  delivery_note_id: dn.id,
                  product_id: item.id,
                  quantity: Number(item.quantity),
                  purchase_price_per_unit: item.unit_price, // Assuming selling price for now or adjust
                  line_total_purchase: Number(item.total || calculateItemTotal(item))
              }]);
          }
      }

      // Mise à jour du stock
      for (const item of invoiceItems) {
        // Update depot-specific stock
        if (selectedDepotId) {
          const { data: depotStock } = await supabase
            .from('stocks')
            .select('id, quantity')
            .eq('product_id', item.id)
            .eq('depot_id', selectedDepotId)
            .maybeSingle();

          if (depotStock) {
            await supabase.from('stocks')
              .update({ quantity: Number(depotStock.quantity) - Number(item.quantity) })
              .eq('id', depotStock.id);
          } else {
            // This case should normally not happen due to POS filtering, 
            // but for safety we could insert if needed.
            await supabase.from('stocks').insert([{
              product_id: item.id,
              depot_id: selectedDepotId,
              quantity: -Number(item.quantity)
            }]);
          }
        }
        
        // Record stock movement
        await supabase.from('stock_movements').insert([{
          product_id: item.id,
          type: 'out',
          quantity: item.quantity,
          price_at_movement: item.unit_price,
          reason: `Vente Facture #${updatedInvoice.number}`,
          user_id: session?.user?.id,
          depot_id: selectedDepotId
        }]);
      }
      
      alert('Paiement finalisé !');
      
      if (printInvoice) {
          setPreviewInvoice(updatedInvoice);
      } 
      
      if (generatedDN) {
          setPreviewDeliveryNote(generatedDN);
      }

      // Handle Direct Printing (if PRÉVISU is unchecked)
      if (!showPreview && (printInvoice || generatedDN)) {
          setTimeout(() => {
              window.print();
              window.location.reload();
          }, 500);
          return;
      }
      
      if (!printInvoice && !generatedDN) {
          window.location.reload();
      }
    } catch (e) {
      console.error("Caught error in handleFinalize:", e);
      alert("Erreur: " + e.message);
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const fetchDepot = async () => {
        if (!selectedDepotId) return;
        const { data, error } = await supabase.from('depots').select('*').eq('id', selectedDepotId).single();
        if (data) setCurrentDepotInfo(data);
    };
    
    const fetchData = async () => {
      // Fetch products - remove '.eq' on stocks to avoid hiding items without stock entry
      let query = supabase
        .from('produits')
        .select(`
          *,
          categories:categories(*),
          stocks(*)
        `)
        .order('name');

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching products with stock:", error);
      }

      if (data) {
        // Map stock quantity from the joined stocks table
        // Show all products in the POS
        const formattedData = data.map(p => ({
            ...p,
            stock_quantity: p.stocks?.find(s => s.depot_id === selectedDepotId)?.quantity || 0
          }));
        setProducts(formattedData);
        setFilteredProducts(formattedData);
      }
    };

    if (selectedDepotId) {
      fetchDepot();
      fetchData();
    }
  }, [selectedDepotId]);

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    setFilteredProducts(term ? products.filter(p => p.name.toLowerCase().includes(term)) : products);
  }, [searchTerm, products]);

  const subtotal = useMemo(() => invoiceItems.reduce((acc, item) => acc + (item.total || (item.quantity * item.unit_price)), 0), [invoiceItems]);
  const lineDiscountsTotal = useMemo(() => invoiceItems.reduce((acc, item) => item.discount ? acc + (item.discount.type === '%' ? (item.quantity * item.unit_price) * (item.discount.value / 100) : item.discount.value) : acc, 0), [invoiceItems]);
  const globalDiscountAmount = useMemo(() => globalDiscount.value > 0 ? (globalDiscount.type === '%' ? (subtotal - lineDiscountsTotal) * (globalDiscount.value / 100) : globalDiscount.value) : 0, [subtotal, lineDiscountsTotal, globalDiscount]);
  const netTotal = useMemo(() => Math.max(0, subtotal - lineDiscountsTotal - globalDiscountAmount), [subtotal, lineDiscountsTotal, globalDiscountAmount]);
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filteredProducts, currentPage]);

  const openDiscountModalForItem = (item) => {
    if (!item || item.isGlobal) setDiscountModal({ itemId: 'global', name: 'Globale', isGlobal: true, value: globalDiscount.value, type: 'Ar' });
    else setDiscountModal({ itemId: item.item_id, name: item.name, isGlobal: false, value: item.discount?.value || 0, type: item.discount?.type || 'Ar' });
  };

  const totalDiscount = useMemo(() => {
    return invoiceItems.reduce((acc, item) => {
        if (!item.discount) return acc;
        const baseTotal = item.quantity * item.unit_price;
        const disc = parseFloat(item.discount.value);
        const discountAmount = item.discount.type === '%' ? (baseTotal * (disc / 100)) : disc;
        return acc + discountAmount;
    }, 0) + globalDiscountAmount;
  }, [invoiceItems, globalDiscountAmount]);

  return (
    <div className="flex flex-col gap-2 h-full p-2 pb-16">
      <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200 flex items-center justify-between">
        <div className="text-base font-black">Facture: {activeInvoice?.number || '...'}</div>
        <div className="flex items-center gap-3">
            <button 
                onClick={() => openDiscountModalForItem(null)}
                className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-black text-[12px] uppercase shadow-md transition-all"
            >
                Remise Totaux
            </button>
            <div className="text-3xl font-black text-red-600">{netTotal.toLocaleString()} Ar</div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-3 h-auto">
          {/* CART */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-black text-gray-700 uppercase text-[15px] flex items-center gap-2"><ShoppingCart size={12} className="text-red-600" /> Panier</h3>
              <span className="bg-red-600 text-white px-1.5 py-0.5 rounded-full text-[14px] font-black">{invoiceItems.length}</span>
            </div>
            {/* Cart Header */}
            <div className="grid grid-cols-12 gap-1 px-2 py-1 bg-gray-100 text-[14px] font-black text-gray-800 uppercase border-b border-gray-200">
              <div className="col-span-3">Produit</div>
              <div className="col-span-2 text-center">Qté</div>
              <div className="col-span-2 text-center">Remise</div>
              <div className="col-span-3 text-right">Total</div>
              <div className="col-span-2 text-center">Action</div>
            </div>
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
              {invoiceItems.map(item => (
                <div key={item.item_id} onClick={() => { setActiveItemId(item.item_id); setIsCalculatorOpen(true); }} className="grid grid-cols-12 gap-1 items-center px-2 py-2 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                  <div className="col-span-3 flex flex-col min-w-0">
                    <div className="font-black text-[14px] uppercase truncate">{item.name}</div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <div className="text-[11px] font-bold text-red-700 bg-red-50 px-1 rounded w-fit">
                        {item.unit_price?.toLocaleString()} Ar / <span className="opacity-70">{item.unite_base || 'Pce'}</span>
                      </div>
                      {item.quantite_par_unite > 1 && item.price_superior && (
                        <div className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1 rounded w-fit">
                          {item.price_superior.toLocaleString()} Ar / <span className="opacity-70">{item.unite_superieure || 'Unité'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 text-center font-black text-[16px] bg-gray-100 rounded">
                    {formatQuantity(item.quantity, item)}
                  </div>
                  <div className="col-span-2 text-center">
                    <button onClick={(e) => { e.stopPropagation(); openDiscountModalForItem(item); }} className="px-2 py-1 text-base font-black text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
                      {item.discount ? `${item.discount.value}` : '+ Remise'}
                    </button>
                  </div>
                  <div className="col-span-3 text-right font-black text-[15px]">{(item.total || calculateItemTotal(item)).toLocaleString()} Ar</div>
                  <div className="col-span-2 text-center">
                    <button onClick={(e) => { e.stopPropagation(); removeItem(item.item_id, item.item_id); }} className="p-1.5 text-red-500 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* VALIDATION */}
          <div className="col-span-12 lg:col-span-4 bg-gray-900 text-white rounded-xl p-2 shadow-xl flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
               <h3 className="font-black text-[14px] uppercase">Paiement</h3>
               {globalDiscountAmount > 0 && (
                   <span className="text-[14px] font-black text-orange-400">Remise: -{globalDiscountAmount.toLocaleString()} Ar</span>
               )}
            </div>

            <div className="grid grid-cols-2 gap-1 p-0.5 bg-gray-800 rounded-lg border border-white/10">
               <button onClick={() => setPaymentMode('cash')} className={`py-1 rounded text-[14px] font-black ${paymentMode === 'cash' ? 'bg-red-600 text-white' : 'text-gray-400'}`}>COMPTANT</button>
               <button onClick={() => {
                   if (paymentMode === 'cash') {
                       setIsAdminAuthOpen(true);
                   } else {
                       setPaymentMode('cash');
                   }
               }} className={`py-1 rounded text-[14px] font-black ${paymentMode === 'credit' ? 'bg-orange-500 text-white' : 'text-gray-400'}`}>CRÉDIT</button>
            </div>

            <div className="p-1.5 bg-gray-800/50 rounded-lg flex flex-col gap-2">
               <div className="flex flex-wrap items-center gap-2">
                 <label className="flex items-center gap-1 text-[13px] font-bold cursor-pointer hover:text-red-400 transition-colors">
                   <input type="checkbox" checked={printInvoice} onChange={() => setPrintInvoice(!printInvoice)} className="accent-red-600 scale-75" /> 
                   FACTURE
                 </label>
                 <label className="flex items-center gap-1 text-[13px] font-bold cursor-pointer hover:text-red-400 transition-colors">
                   <input type="hidden" checked={showPreview} onChange={() => setShowPreview(!showPreview)} className="accent-red-600 scale-75" /> 
                   
                 </label>
                 <label className="flex items-center gap-1 text-[13px] font-bold cursor-pointer hover:text-red-400 transition-colors">
                   <input type="checkbox" checked={isWithdrawal} onChange={() => setIsWithdrawal(!isWithdrawal)} className="accent-red-600 scale-75" /> 
                   B. ENLÈVEMENT
                 </label>
                 <label className="flex items-center gap-1 text-[13px] font-bold cursor-pointer hover:text-red-400 transition-colors">
                   <input type="checkbox" checked={isOther} onChange={() => setIsOther(!isOther)} className="accent-red-600 scale-75" /> 
                   B. LIVRAISON
                 </label>
               </div>
               
               {printInvoice && (
                 <div className="flex gap-1 p-0.5 bg-gray-900 rounded-lg border border-white/5">
                   <button onClick={() => setPrintFormat('ticket')} className={`flex-1 py-1 rounded text-[11px] font-black transition-all ${effectiveFormat === 'ticket' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>TICKET 80mm</button>
                   <button onClick={() => setPrintFormat('A4')} className={`flex-1 py-1 rounded text-[11px] font-black transition-all ${effectiveFormat === 'A4' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-white/5'}`}>FORMAT A4</button>
                 </div>
               )}
            </div>

            {/* Client Info */}
            <div className="grid grid-cols-2 gap-1.5 bg-gray-800/50 p-1.5 rounded-lg border border-white/10">
               <input type="text" className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-white placeholder-gray-500" placeholder="Nom Client" value={clientName} onChange={e => setClientName(e.target.value)} />
               <input type="text" className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-white placeholder-gray-500" placeholder="Téléphone" value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
               <input type="hidden" className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-white placeholder-gray-500" placeholder="Email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
               <input type="hidden" className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-white placeholder-gray-500" placeholder="Adresse" value={clientAddress} onChange={e => setClientAddress(e.target.value)} />
            </div>

            {paymentMode === 'credit' && (
               <div className="grid grid-cols-1 gap-1.5 bg-gray-800/50 p-1.5 rounded-lg border border-white/10">
                   <div className="grid grid-cols-2 gap-1.5">
                       <div className="flex flex-col gap-0.5">
                           <span className="text-[12px] font-black text-gray-400 uppercase">Échéance</span>
                           <input type="date" className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-white" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                       </div>
                       <div className="flex flex-col gap-0.5">
                           <span className="text-[12px] font-black text-gray-400 uppercase">Type</span>
                           <select className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-white" value={creditType} onChange={e => setCreditType(e.target.value)}>
                               <option value="mensuel">Mensuel</option>
                               <option value="journalier">Journalier</option>
                           </select>
                       </div>
                   </div>
                   <div className="flex flex-col gap-0.5">
                       <span className="text-[12px] font-black text-gray-400 uppercase">Avance</span>
                       <input type="number" className="bg-gray-950 border border-white/10 rounded p-1 text-[15px] font-black outline-none w-full text-orange-400" placeholder="0" value={advanceAmount || ''} onChange={e => setAdvanceAmount(e.target.value)} />
                   </div>
               </div>
            )}

            <div className="flex-1" />

            <button onClick={handleFinalize} disabled={isProcessing} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-[15px] uppercase tracking-wider flex items-center justify-center gap-1">
               {isProcessing ? <Loader2 className="animate-spin" size={12} /> : 'FINALISER'}
            </button>
          </div>        </div>

        {/* PRODUCTS LIST */}
        <div className="mt-16 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
           <input type="text" placeholder="Chercher produit..." className="w-full bg-gray-50 p-2 rounded-lg text-base font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           <div className="mt-4 h-auto overflow-y-auto">
             <table className="w-full text-left">
                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.map(p => (
                    <tr key={p.id} onClick={() => Number(p.stock_quantity) > 0 && !pendingProductIds.has(p.id) && addToInvoice(p)} className="border-b border-gray-50 cursor-pointer hover:bg-gray-50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="font-black text-base uppercase">{p.name}</div>
                          {p.type === 'cuisine' && <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full uppercase">Cuisine</span>}
                          {p.type === 'vente' && <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full uppercase">Vente</span>}
                        </div>
                        <div className="text-base text-gray-600 font-black">
                            {p.quantite_par_unite > 1 ? `${Math.floor(p.stock_quantity / p.quantite_par_unite)} ${p.unite_superieure || 'Sac'} + ${p.stock_quantity % p.quantite_par_unite} ${p.unite_base || 'Kg'}` : `${p.stock_quantity} ${p.unite_base || 'Pce'}`}
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-[15px] font-black text-red-700">
                            {p.price_superior > 0 ? (
                              <div className="text-[13px] font-bold">
                                ({p.price.toLocaleString()}/{p.unite_base} et {p.price_superior.toLocaleString()}/{p.unite_superieure}({p.quantite_par_unite}PQT))
                              </div>
                            ) : (
                              <div>{p.price.toLocaleString()} Ar / <span className="text-[12px] uppercase text-red-600/70">{p.unite_base || 'Pce'}</span></div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2 text-right"><Plus size={16} className="inline-block" /></td>
                    </tr>                  ))}
                </tbody>
                </table>
                </div>
                </div>
                </div>

      {isCalculatorOpen && (
        <div 
          className="fixed z-[300] w-full max-w-xs animate-in fade-in duration-200"
          style={{ top: '10%', left: '48%', transform: `translate(${calculatorPos.x}px, ${calculatorPos.y}px)` }}
        >
          <div className="drag-handle cursor-move bg-gray-900 text-white text-[14px] font-black uppercase text-center py-1 rounded-t-xl opacity-80 hover:opacity-100 transition-opacity" onMouseDown={handleMouseDown}>Déplacer</div>
          <Calculator key={activeItemId} activeItem={invoiceItems.find(i => i.item_id === activeItemId)} onResult={handleCalculatorResult} onOpenDiscount={openDiscountModalForItem} onClose={() => setIsCalculatorOpen(false)} />
        </div>
      )}
      {discountModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm">
            <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase">{discountModal.isGlobal ? 'Remise Globale' : `Remise sur ${discountModal.name}`}</h3>
            <div className="space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => setDiscountModal({...discountModal, type: 'Ar'})} className={`flex-1 py-2 rounded-lg text-base font-black transition-all ${discountModal.type === 'Ar' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400'}`}>Ar</button>
              {/* <button class="flex-1 py-2 rounded-lg text-base font-black transition-all bg-white text-emerald-600 shadow-sm">%</button>  <button onClick={() => setDiscountModal({...discountModal, type: '%'})} className={`flex-1 py-2 rounded-lg text-base font-black transition-all ${discountModal.type === '%' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>%</button> */}
              </div>
              <input autoFocus type="number" className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-4 px-6 text-3xl font-black outline-none" value={discountModal.value || ''} onChange={(e) => setDiscountModal({...discountModal, value: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDiscountModal(null)} className="py-3 text-base font-bold text-gray-400 uppercase">Annuler</button>
                <button onClick={() => applyDiscount(discountModal.isGlobal ? 'global' : discountModal.itemId, discountModal.type, discountModal.value)} className="bg-red-600 text-white py-3 rounded-xl text-base font-black shadow-lg">Appliquer</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Combined Preview Modal */}
      {(previewInvoice || previewDeliveryNote) && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          {effectiveFormat === 'A4' ? (
            <style>{`
              @media print {
                @page { size: A4; margin: 20mm; }
                #root { display: none !important; }
                body, html { 
                  margin: 0 auto !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                  overflow: visible !important;
                  height: auto !important;
                  min-height: 0 !important;
                  background: white !important;
                }
                #printable-all-container {
                  visibility: visible !important;
                  display: block !important;
                  position: relative !important;
                  width: 210mm !important;
                  padding: 20mm !important;
                  font-family: Arial, sans-serif !important;
                  color: black !important;
                  border: none !important;
                  background: white !important;
                }
                .print-hide { display: none !important; }
              }
            `}</style>
          ) : (
            <style>{`
              @media print {
                @page { margin: 0 !important; size: 80mm auto; }
                #root { display: none !important; }
                body, html { 
                  margin: 0 auto !important;
                  padding-left: 0 !important;
                  padding-right: 0 !important;
                  overflow: visible !important;
                  height: auto !important;
                  min-height: 0 !important;
                  background: white !important;
                }
                #printable-all-container {
                  visibility: visible !important;
                  display: block !important;
                  position: relative !important;
                  margin: 0 auto !important;
                  width: 76mm !important;
                  max-height: none !important;
                  overflow: visible !important;
                  padding: 0 !important;
                  box-sizing: border-box !important;
                  font-family: 'Courier New', Courier, monospace !important;
                  font-size: 14pt !important;
                  color: black !important;
                  background: white !important;
                }
                #printable-all-container * {
                  color: black !important;
                  background-color: transparent !important;
                }
                .print-hide { display: none !important; }
              }
            `}</style>
          )}
          
          <div id="printable-all-container" className={`bg-white text-black max-h-[90vh] overflow-y-auto ${effectiveFormat === 'A4' ? 'w-[210mm] p-[20mm]' : ''}`}>
            <div className="print-hide p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0">
              <div className="flex flex-col">
                <h3 className="font-bold">Prévisualisation</h3>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setPrintFormat('ticket')} className={`px-2 py-0.5 text-xs rounded border ${effectiveFormat === 'ticket' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}>TICKET (80mm)</button>
                  <button onClick={() => setPrintFormat('A4')} className={`px-2 py-0.5 text-xs rounded border ${effectiveFormat === 'A4' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}>A4</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPreviewInvoice(null); setPreviewDeliveryNote(null); window.location.reload(); }} className="px-3 py-1 bg-gray-200 rounded">Fermer</button>
                <button onClick={() => window.print()} className="px-3 py-1 bg-red-600 text-white font-bold rounded">Imprimer</button>
              </div>
            </div>
            
            {effectiveFormat === 'A4' ? (
              /* A4 Format for Credit Invoices */
              <div id="printable-invoice" className="space-y-6">
                  <div className="flex justify-between items-start bg-red-600 p-8 rounded-t-2xl text-white">
                      <div>
                          <h1 className="text-3xl font-black uppercase text-white">{currentDepotInfo?.name || 'Tranombarotra Hugo'}</h1>
                          <p className="text-sm font-bold opacity-90">{currentDepotInfo?.address || 'Antananarivo'}</p>
                          <p className="text-sm opacity-90">Tél: {currentDepotInfo?.phone || '---'}</p>
                      </div>
                      <div className="text-right">
                          <h2 className="text-2xl font-black uppercase opacity-80">FACTURE DE CRÉDIT</h2>
                          <p className="text-xl font-bold">N° {previewInvoice.number}</p>
                          <p className="text-sm opacity-90">Date: {new Date().toLocaleDateString('fr-FR')}</p>
                      </div>
                  </div>

                  <div className="px-8 space-y-6">
                      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                          <h3 className="text-xs font-black uppercase text-gray-400 mb-2">Informations Client</h3>
                          <p className="text-lg font-black">{clientName || 'Client Inconnu'}</p>
                          {clientPhone && <p className="text-sm">Tél: {clientPhone}</p>}
                          {clientAddress && <p className="text-sm">Adresse: {clientAddress}</p>}
                      </div>

                      <table className="w-full border-collapse">
                          <thead>
                              <tr className="bg-red-600 text-white">
                                  <th className="p-3 text-left uppercase text-xs font-black">Désignation</th>
                                  <th className="p-3 text-center uppercase text-xs font-black">Quantité</th>
                                  <th className="p-3 text-right uppercase text-xs font-black">Prix Unitaire</th>
                                  <th className="p-3 text-right uppercase text-xs font-black">Remise</th>
                                  <th className="p-3 text-right uppercase text-xs font-black">Montant</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 border-b-2 border-gray-100">
                              {invoiceItems.map(item => {
                                  const lineNetTotal = calculateItemTotal(item);
                                  const lineBrutTotal = item.total || (item.quantity * item.unit_price);
                                  const lineDiscount = lineBrutTotal - lineNetTotal;
                                  return (
                                    <tr key={item.item_id}>
                                        <td className="p-3 font-bold uppercase">{item.name}</td>
                                        <td className="p-3 text-center font-bold">{formatQuantity(item.quantity, item)}</td>
                                        <td className="p-3 text-right">
                                            <div className="font-bold">{(item.unit_price).toLocaleString()}</div>
                                            {item.price_superior && (
                                                <div className="text-[10px] text-gray-500 font-medium">
                                                    {item.price_superior.toLocaleString()} / {item.unite_superieure || 'Ctn'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-right text-red-600">{lineDiscount > 0 ? `-${lineDiscount.toLocaleString()}` : '-'}</td>
                                        <td className="p-3 text-right font-black">{lineNetTotal.toLocaleString()}</td>
                                    </tr>
                                  );
                              })}
                          </tbody>
                          </table>

                          <div className="flex justify-end pt-4">
                          <div className="w-80 space-y-2">
                              <div className="flex justify-between text-base font-bold text-gray-700">
                                  <span>TOTAL DES ARTICLES:</span>
                                  <span>{(subtotal - lineDiscountsTotal).toLocaleString()} MGA</span>
                              </div>
                              {globalDiscountAmount > 0 && (
                                  <div className="flex justify-between text-base font-bold text-red-600">
                                      <span>REMISE GLOBALE:</span>
                                      <span>-{globalDiscountAmount.toLocaleString()} MGA</span>
                                  </div>
                              )}
                              <div className="flex justify-between text-2xl font-black text-red-900 border-t-4 border-red-600 pt-2 mt-2">
                                  <span>NET À PAYER:</span>
                                  <span>{parseFloat(previewInvoice.total_amount).toLocaleString()} MGA</span>
                              </div>
                              {paymentMode === 'credit' && advanceAmount > 0 && (
                                  <>
                                    <div className="flex justify-between text-base font-bold text-red-600">
                                        <span>AVANCE VERSÉE:</span>
                                        <span>-{parseFloat(advanceAmount).toLocaleString()} MGA</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-black text-orange-600 border-t border-dashed border-orange-200 pt-2">
                                        <span>RESTE À PAYER:</span>
                                        <span>{(parseFloat(previewInvoice.total_amount) - parseFloat(advanceAmount)).toLocaleString()} MGA</span>
                                    </div>
                                    <div className="text-[11px] font-bold text-gray-400 uppercase text-right mt-1">
                                        Échéance: {new Date(dueDate).toLocaleDateString('fr-FR')}
                                    </div>
                                  </>
                              )}
                          </div>
                          </div>

                      <div className="grid grid-cols-2 gap-12 mt-20">
                          <div className="text-center">
                              <p className="font-black text-xs uppercase text-gray-400 mb-16 underline">Signature du Client</p>
                              <div className="border-t border-gray-300 w-full mx-auto"></div>
                          </div>
                          <div className="text-center">
                              <p className="font-black text-xs uppercase text-gray-400 mb-16 underline">Signature & Cachet Ets</p>
                              <div className="border-t border-gray-300 w-full mx-auto"></div>
                          </div>
                      </div>
                  </div>

                  <div className="text-center text-[10px] text-white mt-12 bg-red-600 p-4 rounded-b-2xl">
                      <p className="font-bold">Merci de votre confiance ! Cette facture est un engagement de paiement aux conditions de crédit mentionnées.</p>
                  </div>
              </div>
            ) : (
              /* Ticket Format (80mm) for Cash Invoices */
              <div className="text-[10pt] leading-tight p-2 space-y-8">
                {previewInvoice && (
                  <div id="printable-invoice">
                      <div className="text-center mb-4 border-b border-dashed border-black pb-2">
                          <h1 className="text-xl font-black uppercase text-red-600">{'Tranombarotra Hugo' || 'Tranombarotra Hugo'}</h1>
                          <p>{currentDepotInfo?.address || 'Antananarivo'}</p>
                          <p>Tél: {currentDepotInfo?.phone || '---'}</p>
                      </div>
                      <div className="mb-4 border-b border-dashed border-black py-1">
                          <p>Facture: <span className="font-bold">{previewInvoice.number}</span></p>
                          <p>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          <p>Client: <span className="font-bold">{clientName || 'Anonyme'}</span></p>
                      </div>
                      <table className="w-full text-left mb-4">
                          <thead>
                              <tr className="border-b border-dashed border-black text-[7pt] uppercase font-black">
                                  <th className="py-1 w-[40%]">Lib.</th>
                                  <th className="py-1 text-center w-[10%] text-[6pt]">Qté</th>
                                  <th className="py-1 text-center w-[10%] text-[6pt]">Unité</th>
                                  <th className="py-1 text-center w-[15%] text-[6pt]">PU(MGA)</th>
                                  <th className="py-1 text-right w-[25%]">Montant</th>
                              </tr>
                          </thead>
                          <tbody>
                              {invoiceItems.map(item => (
                                  <tr key={item.item_id} className="border-b border-dashed border-gray-200 align-top">
                                      <td className="py-2 text-[8pt] font-black uppercase">{item.name}</td>
                                      <td className="py-2 text-[8pt] text-center font-black">
                                          {(() => {
                                            const q = Number(item.quantity) || 0;
                                            const qpu = Number(item.quantite_par_unite) || 1;
                                            const superior = Math.floor(q / qpu);
                                            const base = q % qpu;
                                            return (
                                                <>
                                                    {superior > 0 && <div>{superior}</div>}
                                                    {base > 0 && <div>{base} </div>}
                                                </>
                                            );
                                        })()}
                                      </td>
                                      <td className="font-black py-2 text-[8pt] text-center">
                                        {(() => {
                                            const q = Number(item.quantity) || 0;
                                            const qpu = Number(item.quantite_par_unite) || 1;
                                            const superior = Math.floor(q / qpu);
                                            const base = q % qpu;
                                            const uniteBase = item.unite_base || 'Pce';
                                            const uniteSup = item.unite_superieure || 'Ctn';
                                            return (
                                                <>
                                                    {superior > 0 && <div>{uniteSup}</div>}
                                                    {base > 0 && <div>{uniteBase}</div>}
                                                </>
                                            );
                                        })()}
                                      </td>
                                      <td className="py-2 text-[8pt] text-center leading-tight font-black">
                                        {(() => {
                                            const q = Number(item.quantity) || 0;
                                            const qpu = Number(item.quantite_par_unite) || 1;
                                            const superior = Math.floor(q / qpu);
                                            const base = q % qpu;
                                            const priceSup = Number(item.price_superior) || 0;
                                            const priceBase = Number(item.unit_price) || 0;
                                            
                                            return (
                                                <>
                                                    {superior > 0 && <div style={{ fontSize: '8pt' }}>{priceSup.toLocaleString('fr-MG')}</div>}
                                                    {base > 0 && <div style={{ fontSize: '8pt' }}> {priceBase.toLocaleString('fr-MG')}</div>}
                                                </>
                                            );
                                        })()}
                                      </td>
                                      <td className="py-2 text-right font-black text-[8pt]">
                                          {(item.total || item.quantity * item.unit_price).toLocaleString()}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      <div className="border-t border-dashed border-black pt-2 text-right">
                          <p className="font-bold">Total Brut: {subtotal.toLocaleString()} MGA</p>
                          {lineDiscountsTotal > 0 && (
                              <p className="font-bold text-red-600">Remise Partielle: -{lineDiscountsTotal.toLocaleString()} MGA</p>
                          )}
                          {globalDiscountAmount > 0 && (
                              <p className="font-bold text-red-600">Remise Totaux: -{globalDiscountAmount.toLocaleString()} MGA</p>
                          )}
                          <p className="font-black text-lg mt-2 ">Net à payer: {parseFloat(previewInvoice.total_amount).toLocaleString()} MGA</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-6 text-sm">
                          <div className="text-center">
                              <p className="font-bold">Client</p>
                              <div className="h-16 border-b border-black"></div>
                          </div>
                          <div className="text-center">
                              <p className="font-bold">Vendeur</p>
                              <div className="h-16 border-b border-black"></div>
                          </div>
                      </div>
                  </div>
                )}
                
                {previewDeliveryNote && (
                  <div id="printable-dn" className="border-t-2 border-solid border-black pt-8">
                      <div className="text-center mb-4 border-b border-dashed border-black pb-2">
                          <h1 className="text-xl font-black uppercase">BON DE SORTIE</h1>
                          <p className="font-black">Tranombarotra Hugo</p>
                          <p>Tél: 0387060782</p>
                          <p>Facture Réf: <span className="font-bold">{activeInvoice.number}</span></p>
                          <p>N°: <span className="font-bold">{previewDeliveryNote.bl_number}</span></p>
                          <p>Date: {new Date(previewDeliveryNote.created_at).toLocaleDateString()}</p>
                      </div>
                      
                      <table className="w-full text-left mb-4">
                          <thead>
                              <tr className="border-b border-dashed border-black">
                                  <th className="py-1">Désignation</th>
                                  <th className="py-1 text-right">Total</th>
                              </tr>
                          </thead>
                          <tbody>
                              {invoiceItems.map(item => (
                                  <tr key={item.item_id}>
                                      <td className="py-1">
                                          <div className="font-bold">{item.name}</div>
                                          <div className="text-[9pt]">{formatQuantity(item.quantity, item)}</div>
                                      </td>
                                      <td className="py-1 text-right font-bold">
                                          {(item.total || calculateItemTotal(item)).toLocaleString()}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>

                      <div className="border-t border-dashed border-black pt-2 text-right">
                          <p className="font-bold">Total Brut: {subtotal.toLocaleString()} MGA</p>
                          {lineDiscountsTotal > 0 && (
                              <p className="font-bold text-red-600">Remise Partiel: -{lineDiscountsTotal.toLocaleString()} MGA</p>
                          )}
                          {globalDiscountAmount > 0 && (
                              <p className="font-bold text-red-600">REMISE TOTAUX: -{globalDiscountAmount.toLocaleString()} MGA</p>
                          )}
                          <p className="font-black text-lg mt-2">NET À PAYER: {parseFloat(previewDeliveryNote.total_amount).toLocaleString()} MGA</p>
                      </div>

                      <div className="text-center mt-6 text-sm">
                          <p className="font-bold">Signature & Cachet</p>
                          <div className="h-20 border-b border-black"></div>
                      </div>
                  </div>
                )}
                  
                <div className="text-center mt-2 text-sm border-t border-dashed border-black pt-2">
                    <p>Merci de votre confiance !</p>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
      {isAdminAuthOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl">
                        <h3 className="text-2xl font-black text-gray-800 uppercase">Code Administrateur</h3>
                        <input 
                            type="password" 
                            placeholder="Code secret" 
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-4 text-2xl font-black outline-none" 
                            value={adminAuthCode} 
                            onChange={e => setAdminAuthCode(e.target.value)} 
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setIsAdminAuthOpen(false); setAdminAuthCode(''); }} className="flex-1 py-4 font-bold text-gray-400">Annuler</button>
                            <button onClick={() => {
                                if (adminAuthCode === dbAdminCode) {
                                    setPaymentMode('credit');
                                    setIsAdminAuthOpen(false);
                                    setAdminAuthCode('');
                                } else {
                                    alert("Code incorrect");
                                }
                            }} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl">Valider</button>
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
}
