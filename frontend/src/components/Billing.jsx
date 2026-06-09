import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { Plus, Search, FileText, Trash2, Edit2, Calendar, User, DollarSign, Loader2, CheckCircle, Clock, XCircle, Eye, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function Billing({ initialSearchTerm, onSearchReset }) {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [viewingItems, setViewingItems] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [printFormat, setPrintFormat] = useState('auto'); // 'auto', 'A4', or 'ticket'

  const getEffectiveFormat = () => {
    if (printFormat !== 'auto') return printFormat;
    return viewingInvoice?.type === 'CRÉDIT' ? 'A4' : 'ticket';
  };

  const effectiveFormat = getEffectiveFormat();

  const openViewModal = async (inv) => {
    setViewingInvoice(inv);
    const { data: items } = await supabase
        .from('facture_items')
        .select('*, produits(name, price, price_superior, unite_base, unite_superieure, quantite_par_unite)')
        .eq('facture_id', inv.id);
    setViewingItems(items || []);
  };

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  
  const [formData, setFormData] = useState({
    client_id: '',
    guest_name: '',
    guest_contact: '',
    number: '',
    total_amount: '',
    status: 'draft',
    due_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: invs } = await supabase
      .from('factures')
      .select('*, clients(name, email, phone, address)')
      .order('created_at', { ascending: false });
    
    const { data: cls } = await supabase.from('clients').select('*').order('name');
    const { data: profs } = await supabase.from('profiles').select('id, full_name');
    
    if (invs) {
      setInvoices(invs);
    }
    if (cls) setClients(cls);
    if (profs) setUsers(profs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = invoices.filter(inv => {
      const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.clients?.name || inv.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUser = selectedUser === 'all' || inv.user_id === selectedUser;
      const isNotDraft = inv.status !== 'draft';
      return matchesSearch && matchesUser && isNotDraft;
    });
    setFilteredInvoices(filtered);
  }, [searchTerm, invoices, selectedUser]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (editingInvoice) {
        // ... (existing code for updating)
        const newTotal = viewingItems.reduce((acc, i) => {
            const q = i.quantity || 0;
            const qpu = Number(i.produits?.quantite_par_unite) || 1;
            const superior = Math.floor(q / qpu);
            const base = q % qpu;
            const priceSup = Number(i.produits?.price_superior) || 0;
            const priceBase = Number(i.unit_price) || 0;
            const totalLine = (superior * priceSup) + (base * priceBase);
            const discountVal = i.discount ? (i.discount.type === '%' ? (totalLine * parseFloat(i.discount.value) / 100) : parseFloat(i.discount.value)) : 0;
            return acc + (totalLine - discountVal);
        }, 0);

        if (formData.status === 'cancelled' && editingInvoice.status !== 'cancelled') {
            await cancelInvoice(editingInvoice);
        }

        const { error } = await supabase
            .from('factures')
            .update({
            client_id: formData.client_id || null,
            guest_name: formData.guest_name || null,
            guest_contact: formData.guest_contact || null,
            number: formData.number,
            total_amount: newTotal,
            status: formData.status,
            due_date: formData.due_date
            })
            .eq('id', editingInvoice.id);
        
        if (error) alert(error.message);
        else {
            resetForm();
            fetchData();
        }
    } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('factures').insert([{
            ...formData,
            client_id: formData.client_id || null,
            guest_name: formData.guest_name || null,
            guest_contact: formData.guest_contact || null,
            total_amount: parseFloat(formData.total_amount),
            user_id: user.id
        }]);
        
        if (error) alert(error.message);
        else {
            resetForm();
            fetchData();
        }
    }
    setIsSubmitting(false);
  };

  const handleEdit = async (invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id || '',
      number: invoice.number,
      total_amount: invoice.total_amount,
      status: invoice.status,
      due_date: invoice.due_date || new Date().toISOString().split('T')[0]
    });
    
    // Fetch items
    const { data: items } = await supabase
        .from('facture_items')
        .select('*, produits(*)')
        .eq('facture_id', invoice.id);
    setViewingItems(items || []);
    
    setShowModal(true);
  };

  const deleteItem = async (item) => {
    if (!confirm('Supprimer cet article de la facture et réintégrer le stock ?')) return;

    try {
        const { produit_id, quantity, facture_id } = item;
        const depotId = editingInvoice.depot_id;

        // 1. Reintegrate stock
        if (depotId) {
            const { data: depotStock } = await supabase
                .from('stocks')
                .select('id, quantity')
                .eq('product_id', produit_id)
                .eq('depot_id', depotId)
                .maybeSingle();

            if (depotStock) {
                await supabase.from('stocks')
                .update({ quantity: Number(depotStock.quantity) + Number(quantity) })
                .eq('id', depotStock.id);
            } else {
                await supabase.from('stocks').insert({
                    product_id: produit_id,
                    depot_id: depotId,
                    quantity: quantity
                });
            }
        }

        // 2. Delete item
        await supabase.from('facture_items').delete().eq('id', item.id);

        // 3. Recalculate and update invoice total
        const remainingItems = viewingItems.filter(i => i.id !== item.id);
        const newTotal = remainingItems.reduce((acc, i) => {
            const q = i.quantity || 0;
            // Fetch product info if missing (in case of incomplete join)
            const p = i.produits || {}; 
            const qpu = Number(p.quantite_par_unite) || 1;
            const superior = Math.floor(q / qpu);
            const base = q % qpu;
            const priceSup = Number(p.price_superior) || 0;
            const priceBase = Number(i.unit_price) || 0;
            
            const totalBeforeDiscount = (superior * priceSup) + (base * priceBase);
            const discountVal = i.discount ? (i.discount.type === '%' ? (totalBeforeDiscount * parseFloat(i.discount.value) / 100) : parseFloat(i.discount.value)) : 0;
            return acc + (totalBeforeDiscount - discountVal);
        }, 0);

        await supabase.from('factures').update({ total_amount: newTotal }).eq('id', facture_id);

        setViewingItems(remainingItems);
        setFormData(prev => ({...prev, total_amount: newTotal}));
        fetchData();
        alert('Article supprimé, stock réintégré et total mis à jour.');
    } catch (error) {
        console.error('Erreur suppression article:', error);
        alert('Erreur : ' + error.message);
    }
  };

  const deleteInvoice = async (invoice) => {
    if (!confirm('Supprimer cette facture et réintégrer les stocks ?')) return;

    try {
      // 1. Get items and the depot_id of the invoice
      const { data: invoiceData, error: invError } = await supabase
        .from('factures')
        .select('depot_id')
        .eq('id', invoice.id)
        .single();
        
      if (invError) throw invError;
      const depotId = invoiceData.depot_id;

      const { data: items, error: itemsError } = await supabase
        .from('facture_items')
        .select('produit_id, quantity')
        .eq('facture_id', invoice.id);

      if (itemsError) throw itemsError;

      // 2. Reintegrate stock in the specific depot
      if (depotId) {
        for (const item of items) {
          const { data: depotStock } = await supabase
            .from('stocks')
            .select('id, quantity')
            .eq('product_id', item.produit_id)
            .eq('depot_id', depotId)
            .maybeSingle();

          if (depotStock) {
            await supabase.from('stocks')
              .update({ quantity: Number(depotStock.quantity) + Number(item.quantity) })
              .eq('id', depotStock.id);
          } else {
            await supabase.from('stocks').insert({
                product_id: item.produit_id,
                depot_id: depotId,
                quantity: item.quantity
            });
          }
        }
      }

      // 3. Delete invoice and items
      await supabase.from('facture_items').delete().eq('facture_id', invoice.id);
      await supabase.from('factures').delete().eq('id', invoice.id);

      alert('Facture supprimée et stocks réintégrés !');
      fetchData();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression : ' + error.message);
    }
  };

  const cancelInvoice = async (invoice) => {
    if (!confirm('Annuler cette facture et réintégrer les stocks ?')) return;

    try {
      // 1. Get items and the depot_id of the invoice
      const { data: invoiceData, error: invError } = await supabase
        .from('factures')
        .select('depot_id')
        .eq('id', invoice.id)
        .single();
        
      if (invError) throw invError;
      const depotId = invoiceData.depot_id;

      const { data: items, error: itemsError } = await supabase
        .from('facture_items')
        .select('produit_id, quantity')
        .eq('facture_id', invoice.id);

      if (itemsError) throw itemsError;

      // 2. Reintegrate stock in the specific depot
      if (depotId) {
        for (const item of items) {
          const { data: depotStock } = await supabase
            .from('stocks')
            .select('id, quantity')
            .eq('product_id', item.produit_id)
            .eq('depot_id', depotId)
            .maybeSingle();

          if (depotStock) {
            await supabase.from('stocks')
              .update({ quantity: Number(depotStock.quantity) + Number(item.quantity) })
              .eq('id', depotStock.id);
          } else {
            // If the stock entry doesn't exist, create it (should rarely happen)
            await supabase.from('stocks').insert({
                product_id: item.produit_id,
                depot_id: depotId,
                quantity: item.quantity
            });
          }
        }
      }

      // 3. Mark invoice as cancelled
      await supabase
        .from('factures')
        .update({ status: 'cancelled' })
        .eq('id', invoice.id);

      alert('Facture annulée et stocks réintégrés dans le dépôt !');
      fetchData();
    } catch (error) {
      console.error('Erreur annulation:', error);
      alert('Erreur lors de l\'annulation : ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      number: `FAC-${Date.now().toString().slice(-6)}`,
      total_amount: '',
      status: 'draft',
      due_date: new Date().toISOString().split('T')[0]
    });
    setEditingInvoice(null);
    setShowModal(false);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'paid': return 'bg-gray-50 text-red-600 border-gray-100';
      case 'sent':
      case 'pending':
      case 'en cours': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle size={14} />;
      case 'sent':
      case 'pending':
      case 'en cours': return <Clock size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const downloadPDF = async (inv) => {
    setIsGeneratingPDF(true);
    
    // Fetch depot info: prefer the invoice's depot, fallback to any depot containing 'principal' or the first available
    let depotId = inv.depot_id;
    let depotInfo = null;

    if (depotId) {
        const { data } = await supabase.from('depots').select('*').eq('id', depotId).maybeSingle();
        depotInfo = data;
    }

    if (!depotInfo) {
        const { data: allDepots } = await supabase.from('depots').select('*');
        depotInfo = allDepots?.find(d => d.name.toLowerCase().includes('principal')) || allDepots?.[0];
    }

    const logoBase64 = ''; // PASTE YOUR BASE64 LOGO HERE

    const invoiceElement = document.createElement('div');
    invoiceElement.style.width = '800px';
    invoiceElement.style.padding = '40px';
    invoiceElement.style.backgroundColor = '#ffffff';
    invoiceElement.style.color = '#333';
    invoiceElement.style.fontFamily = 'sans-serif';
    
    // Fetch items with product names and discounts for the invoice
    const { data: items } = await supabase
      .from('facture_items')
      .select('quantity, unit_price, discount, discount_value, discount_type, unit_type, produits(name, price, price_superior, unite_base, unite_superieure, quantite_par_unite)')
      .eq('facture_id', inv.id);

    let totalDiscount = 0;
    const itemsHtml = (items || []).map(item => {
        const p = item.produits || {};
        const q = item.quantity || 0;
        const qpu = Number(p.quantite_par_unite) || 1;
        const superior = Math.floor(q / qpu);
        const base = q % qpu;
        
        // Logique PU :
        let puDisplay = '';
        if (superior > 0 && base > 0) {
            // Règle 1: Mixte (Carton + Paquet)
            puDisplay = `<div style="font-size: 4px;">P/${p.unite_base}: ${priceBase.toLocaleString('fr-MG')} ar</div>
                         <div style="font-size: 4px;">P/${p.unite_superieure}: ${priceSup.toLocaleString('fr-MG')} ar</div>`;
        } else if (superior > 0 && base === 0) {
            // Règle 2: Unité supérieure seulement
            puDisplay = `<div style="font-size: 4px;">P/${p.unite_superieure}: ${priceSup.toLocaleString('fr-MG')} ar</div>`;
        } else {
            // Règle 3: Unité de base seulement
            puDisplay = `<div style="font-size: 4px;">P/${p.unite_base}: ${priceBase.toLocaleString('fr-MG')} ar</div>`;
        }

        return `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 15px 0;">
              <p style="font-size: 14px; font-weight: 700; color: #1f2937; margin: 0;">${p.name || 'Produit Inconnu'}</p>
              <div style="margin: 2px 0;">
                ${puDisplay}
              </div>
            </td>
            <td style="padding: 15px 0; text-align: center; font-size: 14px; font-weight: 700; color: #4b5563;">${qDisplay}</td>
            <td style="padding: 15px 0; text-align: right; font-size: 14px; font-weight: 700; color: #ef4444;">${discountVal > 0 ? `-${discountVal.toLocaleString('fr-MG')}` : '-'}</td>
            <td style="padding: 15px 0; text-align: right; font-size: 14px; font-weight: 900; color: #111827;">${total.toLocaleString('fr-MG')} Ar</td>
          </tr>
        `;
    }).join('');

    const clientInfo = `
      <div style="flex: 1; padding: 20px; background: #f9fafb; border-radius: 12px;">
        <p style="font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase; margin-bottom: 10px;">Informations Client</p>
        <p style="font-size: 16px; font-weight: 900; color: #111827; margin: 0;">${inv.clients?.name || inv.guest_name || 'Client Direct'}</p>
        <p style="font-size: 12px; color: #4b5563; margin: 5px 0;">${inv.clients?.address || inv.guest_contact || ''}</p>
        <p style="font-size: 12px; color: #4b5563; margin: 0;">${inv.clients?.phone || ''}</p>
      </div>
    `;

    const isCredit = inv.status !== 'paid';

    invoiceElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 30px; margin-bottom: 40px;">
        <div style="flex: 1;">
          <h1 style="font-size: 28px; font-weight: 900; color: #059669; margin: 0; text-transform: uppercase;">${depotInfo?.name || 'Extrême Buritos'}</h1>
          <p style="font-size: 14px; font-weight: 900; color: #374151; margin: 5px 0;">${depotInfo?.location || ''}</p>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">NIF: ${depotInfo?.nif || 'En cours'} | STAT: ${depotInfo?.stat || 'En cours'}</p>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">${depotInfo?.address || 'Madagascar'}</p>
          <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">Contact: ${depotInfo?.phone || 'N/A'}</p>
        </div>
        <div style="flex: 1; text-align: right;">
          <div style="display: inline-block; padding: 5px 15px; border-radius: 8px; background: ${isCredit ? '#fff7ed' : '#ecfdf5'}; color: ${isCredit ? '#c2410c' : '#047857'}; font-size: 12px; font-weight: 900; text-transform: uppercase; border: 1px solid ${isCredit ? '#fdba74' : '#6ee7b7'}; margin-bottom: 10px;">
            ${isCredit ? 'Paiement à Crédit' : 'Paiement Comptant'}
          </div>
          <h2 style="font-size: 32px; font-weight: 900; color: #e5e7eb; margin: 0; text-transform: uppercase;">FACTURE</h2>
          <p style="font-size: 18px; font-weight: 900; color: #1f2937; margin: 5px 0;">${inv.number}</p>
          <p style="font-size: 14px; font-weight: 700; color: #6b7280; margin: 5px 0;">Date & Heure: ${new Date(inv.created_at).toLocaleDateString('fr-FR')} ${new Date(inv.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</p>
        </div>
      </div>

      <div style="display: flex; gap: 40px; margin-bottom: 40px;">
        ${clientInfo}
      </div>

      <div style="margin-bottom: 40px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #f3f4f6;">
              <th style="padding: 15px 0; text-align: left; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Produit (PU)</th>
              <th style="padding: 15px 0; text-align: center; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Qté</th>
              <th style="padding: 15px 0; text-align: right; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Remise</th>
              <th style="padding: 15px 0; text-align: right; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            ${totalDiscount > 0 ? `
            <tr>
              <td colspan="3" style="padding: 15px 0 0 0; text-align: right; font-size: 14px; font-weight: 900; color: #ef4444; text-transform: uppercase;">REMISE TOTAUX</td>
              <td style="padding: 15px 0 0 0; text-align: right; font-size: 14px; font-weight: 900; color: #ef4444;">-${totalDiscount.toLocaleString('fr-MG')} MGA</td>
            </tr>
            ` : ''}
            <tr>
              <td colspan="3" style="padding: 15px 0; text-align: right; font-size: 14px; font-weight: 900; color: #6b7280; text-transform: uppercase;">TOTAL NET À PAYER</td>
              <td style="padding: 15px 0; text-align: right; font-size: 18px; font-weight: 900; color: #059669;">${inv.total_amount.toLocaleString('fr-MG')} MGA</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 60px; padding: 0 20px;">
        <div style="text-align: center;">
          <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #374151; margin-bottom: 50px;">Signature Client</p>
          <div style="width: 150px; border-bottom: 1px solid #d1d5db;"></div>
        </div>
        <div style="text-align: center;">
          <p style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #374151; margin-bottom: 50px;">Signature Fournisseur / Cachet</p>
          <div style="width: 150px; border-bottom: 1px solid #d1d5db;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(invoiceElement);
    
    try {
      // Give the browser a moment to render the element
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        width: 800
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`facture-${inv.number}.pdf`);
    } catch (error) {
      console.error('PDF Error:', error);
      alert(`Erreur lors de la génération du PDF: ${error.message}`);
    } finally {
      if (document.body.contains(invoiceElement)) {
        document.body.removeChild(invoiceElement);
      }
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-gray-50 gap-4">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher une facture (N° ou client)..." 
              className="w-full bg-white border border-gray-100 rounded-xl py-2 pl-10 pr-4 text-lg focus:ring-2 focus:ring-red-500/20 transition-all outline-none" 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onSearchReset?.();
              }}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-1.5 min-w-[200px]">
            <User size={16} className="text-gray-500" />
            <select 
              className="bg-transparent border-none text-[17px] font-black outline-none w-full cursor-pointer uppercase"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="all">Tous les comptes</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || 'Utilisateur'}</option>)}
            </select>
          </div>
        </div>
        
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-red-200">
          <Plus size={18} /> <span>Nouvelle Facture</span>
        </button>
      </div>

      {/* Invoice List - Desktop Table */}
      <div className="hidden md:block bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl overflow-hidden shadow-sm min-h-[600px] max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-gray-50/95 z-10">
            <tr>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">N° Facture</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">Date & Heure</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">Vendeur</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">Client</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest">Statut</th>
              <th className="p-5 text-base font-bold text-red-600 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan="6" className="p-10 text-center text-gray-400">Chargement des factures...</td></tr>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/20 transition-colors group">
                  <td className="p-5 font-bold text-gray-800 flex items-center gap-2">
                    <FileText size={16} className="text-gray-500" /> {inv.number}
                  </td>
                  <td className="p-5 text-[17px] font-bold text-gray-600">
                    {new Date(inv.created_at).toLocaleDateString('fr-FR')} {new Date(inv.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-[16px] font-black text-red-600">
                            {(inv.profiles?.full_name || 'U')[0]}
                        </div>
                        <span className="text-[17px] font-black text-gray-500 uppercase tracking-tighter">
                            {inv.profiles?.full_name || 'Inconnu'}
                        </span>
                    </div>
                  </td>
                  <td className="p-5 text-gray-600 font-medium">
                    {inv.clients?.name || inv.guest_name || 'Client Direct'}
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[15px] font-black uppercase border flex items-center gap-1.5 w-fit tracking-widest ${getStatusStyle(inv.status)}`}>
                      {getStatusIcon(inv.status)} {inv.status}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-center gap-3">
                      <button 
                        onClick={() => openViewModal(inv)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" 
                        title="Voir détails"
                      >
                        <Eye size={18} />
                      </button>
                      {inv.status === 'paid' && (
                        <button onClick={() => cancelInvoice(inv)} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors" title="Annuler">
                          <XCircle size={18} />
                        </button>
                      )}
                      {inv.status !== 'cancelled' && (
                        <button onClick={() => handleEdit(inv)} className="p-2 bg-gray-50 text-red-600 rounded-lg hover:bg-gray-100 transition-colors" title="Éditer">
                          <Edit2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" className="p-10 text-center text-gray-400">Aucune facture enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice List - Mobile Cards */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <p className="text-center py-10 text-gray-400">Chargement des factures...</p>
        ) : filteredInvoices.length > 0 ? (
          filteredInvoices.map((inv) => (
            <div key={inv.id} className="bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-red-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{inv.number}</h4>
                    <p className="text-base text-gray-500">{inv.clients?.name || 'Client inconnu'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[15px] font-bold uppercase border flex items-center gap-1 ${getStatusStyle(inv.status)}`}>
                  {getStatusIcon(inv.status)} {inv.status}
                </span>
              </div>
              
              <div className="flex justify-between items-end pt-2 border-t border-gray-50">
                <div>
                  <p className="text-[15px] text-gray-400 uppercase font-bold tracking-widest">Montant Total</p>
                  <p className="text-2xl font-black text-gray-800">{inv.total_amount.toLocaleString('fr-MG')} MGA</p>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => downloadPDF(inv)} 
                    disabled={isGeneratingPDF}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                  >
                    <Download size={16} />
                  </button>
                  {inv.status === 'paid' && (
                    <button onClick={() => cancelInvoice(inv)} className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                      <XCircle size={16} />
                    </button>
                  )}
                  {inv.status !== 'cancelled' && (
                    <button onClick={() => handleEdit(inv)} className="p-2 bg-gray-50 text-red-600 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                  )}
                  <button onClick={() => deleteInvoice(inv)} className="p-2 bg-red-50 text-red-600 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[16px] text-gray-500">
                <Calendar size={12} />
                <span>Échéance : {inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-'}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-10 text-gray-400">Aucune facture enregistrée.</p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <h3 className="text-3xl font-bold text-gray-800">
                {editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-3xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[16px] font-bold text-red-600 uppercase ml-1">N° Facture</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input required className="w-full bg-gray-50/50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 transition-all" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Client</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select className="w-full bg-gray-50/50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 transition-all appearance-none" value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                      <option value="">Choisir...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Nom Invité</label>
                  <input className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none" value={formData.guest_name} onChange={e => setFormData({...formData, guest_name: e.target.value})} placeholder="Si pas de client" />
                </div>
                <div className="space-y-1">
                  <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Contact Invité</label>
                  <input className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none" value={formData.guest_contact} onChange={e => setFormData({...formData, guest_contact: e.target.value})} placeholder="Numéro..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Montant Total (MGA)</label>
                  <div className="relative">
                    <input required type="number" step="0.01" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 transition-all" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Échéance</label>
                  <div className="relative">
                    <input required type="date" className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 transition-all" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Statut</label>
                <div className="flex gap-2">
                  {['draft', 'sent', 'paid', 'cancelled'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({...formData, status: s})}
                      className={`flex-1 py-2 rounded-xl text-[16px] font-bold uppercase border transition-all ${
                        formData.status === s 
                          ? getStatusStyle(s) + ' border-gray-500 scale-[1.05]' 
                          : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[16px] font-bold text-red-600 uppercase ml-1">Articles</label>
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-base">
                        <tbody className="divide-y divide-gray-50">
                            {viewingItems.map(item => (
                                <tr key={item.id}>
                                    <td className="p-2 font-bold">{item.produits?.name || 'Inconnu'}</td>
                                    <td className="p-2 text-right">
                                        {(() => {
                                            const q = item.quantity || 0;
                                            const p = item.produits || {};
                                            const qpu = Number(p.quantite_par_unite) || 1;
                                            const superior = Math.floor(q / qpu);
                                            const base = q % qpu;
                                            
                                            return (
                                                <div className="flex flex-col items-end">
                                                    <div className="text-[15px] font-black text-red-800">
                                                        {qpu > 1 ? (
                                                            <>
                                                                {superior > 0 && <span>{superior} <span className="text-[11px] uppercase text-red-600">{p.unite_superieure || 'Ctn'}</span></span>}
                                                                {superior > 0 && base > 0 && <span className="mx-1 text-gray-400">+</span>}
                                                                {(base > 0 || superior === 0) && <span>{base} <span className="text-[11px] uppercase text-red-600">{p.unite_base || 'Pce'}</span></span>}
                                                            </>
                                                        ) : (
                                                            <span>{q} <span className="text-[11px] uppercase text-red-600">{p.unite_base || 'Pce'}</span></span>
                                                        )}
                                                    </div>
                                                    {qpu > 1 && (
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                                            Total: {q} {p.unite_base} | 1 {p.unite_superieure} = {qpu} {p.unite_base}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="p-2 text-right">
                                        <button onClick={() => deleteItem(item)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingInvoice ? "Mettre à jour" : "Créer la facture")}
              </button>
            </form>
          </div>
        </div>
      )}
      {viewingInvoice && createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          {effectiveFormat === 'A4' ? (
            <style>{`
              @media print {
                @page { size: A4; margin: 20mm; }
                #root { display: none !important; }
                body, html { 
                  margin: 0 auto !important; 
                  padding: 0 !important; 
                  height: auto !important;
                  min-height: 0 !important;
                  background: white !important;
                }
                #printable-invoice-container {
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
                  padding: 0 !important; 
                  height: auto !important;
                  min-height: 0 !important;
                  background: white !important;
                }
                #printable-invoice-container {
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
                #printable-invoice-container * {
                  color: black !important;
                  background-color: transparent !important;
                }
                .print-hide { display: none !important; }
              }
            `}</style>
          )}
          
          <div id="printable-invoice-container" className={`bg-white text-black max-h-[90vh] overflow-y-auto ${effectiveFormat === 'A4' ? 'w-[210mm] p-[20mm]' : ''}`}>
            <div className="print-hide p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0">
              <div className="flex flex-col">
                <h3 className="font-bold">Prévisualisation</h3>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setPrintFormat('ticket')} className={`px-2 py-0.5 text-xs rounded border ${effectiveFormat === 'ticket' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}>TICKET (80mm)</button>
                  <button onClick={() => setPrintFormat('A4')} className={`px-2 py-0.5 text-xs rounded border ${effectiveFormat === 'A4' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300'}`}>A4</button>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewingInvoice(null)} className="px-3 py-1 bg-gray-200 rounded">Fermer</button>
                <button onClick={() => window.print()} className="px-3 py-1 bg-red-600 text-white font-bold rounded">Imprimer</button>
              </div>
            </div>
            
            {effectiveFormat === 'A4' ? (
              /* A4 Format for Credit Invoices */
              <div id="printable-invoice" className="space-y-6">
                  <div className="flex justify-between items-start bg-red-600 p-8 rounded-t-2xl text-white">
                      <div>
                          <h1 className="text-3xl font-black uppercase text-white">Extrême Buritos</h1>
                          <p className="text-sm font-bold opacity-90">Antananarivo</p>
                      </div>
                      <div className="text-right">
                          <h2 className="text-2xl font-black uppercase opacity-80">FACTURE DE CRÉDIT</h2>
                          <p className="text-xl font-bold">N° {viewingInvoice.number}</p>
                          <p className="text-sm opacity-90">Date: {new Date(viewingInvoice.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                  </div>

                  <div className="px-8 space-y-6">
                      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                          <h3 className="text-xs font-black uppercase text-gray-400 mb-2">Informations Client</h3>
                          <p className="text-lg font-black">{viewingInvoice.clients?.name || viewingInvoice.guest_name || 'Client Inconnu'}</p>
                          {(viewingInvoice.clients?.phone || viewingInvoice.guest_contact) && <p className="text-sm">Tél: {viewingInvoice.clients?.phone || viewingInvoice.guest_contact}</p>}
                          {viewingInvoice.clients?.address && <p className="text-sm">Adresse: {viewingInvoice.clients.address}</p>}
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
                              {viewingItems.map(item => {
                                  const q = Number(item.quantity) || 0;
                                  const p = item.produits || {};
                                  const qpu = Number(p.quantite_par_unite) || 1;
                                  const superior = Math.floor(q / qpu);
                                  const base = q % qpu;
                                  const priceSup = Number(p.price_superior) || 0;
                                  const priceBase = Number(item.unit_price) || 0;
                                  const lineBrutTotal = (superior * priceSup) + (base * priceBase);
                                  
                                  const discValue = item.discount?.value || item.discount_value || 0;
                                  const discType = item.discount?.type || item.discount_type || 'Ar';
                                  const lineDiscount = discType === '%' ? (lineBrutTotal * parseFloat(discValue) / 100) : parseFloat(discValue);
                                  const lineNetTotal = lineBrutTotal - lineDiscount;

                                  return (
                                    <tr key={item.id}>
                                        <td className="p-3 font-bold uppercase">{p.name}</td>
                                        <td className="p-3 text-center font-bold">
                                            {qpu > 1 ? (
                                                <>
                                                    {superior > 0 && <span>{superior} {p.unite_superieure || 'Ctn'}</span>}
                                                    {superior > 0 && base > 0 && <span className="mx-1">+</span>}
                                                    {base > 0 && <span>{base} {p.unite_base || 'Pce'}</span>}
                                                </>
                                            ) : (
                                                <span>{q} {p.unite_base || 'Pce'}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="font-bold">{priceBase.toLocaleString()}</div>
                                            {priceSup > 0 && (
                                                <div className="text-[10px] text-gray-500 font-medium">
                                                    {priceSup.toLocaleString()} / {p.unite_superieure || 'Ctn'}
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
                              <div className="flex justify-between text-2xl font-black text-red-800 border-t-4 border-red-600 pt-2 mt-2">
                                  <span>NET À PAYER:</span>
                                  <span>{parseFloat(viewingInvoice.total_amount).toLocaleString()} MGA</span>
                              </div>
                              {viewingInvoice.advance_amount > 0 && (
                                  <>
                                    <div className="flex justify-between text-base font-bold text-red-600">
                                        <span>AVANCE VERSÉE:</span>
                                        <span>-{parseFloat(viewingInvoice.advance_amount).toLocaleString()} MGA</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-black text-orange-600 border-t border-dashed border-orange-200 pt-2">
                                        <span>RESTE À PAYER:</span>
                                        <span>{(parseFloat(viewingInvoice.total_amount) - parseFloat(viewingInvoice.advance_amount)).toLocaleString()} MGA</span>
                                    </div>
                                    <div className="text-[11px] font-bold text-gray-400 uppercase text-right mt-1">
                                        Échéance: {new Date(viewingInvoice.due_date).toLocaleDateString('fr-FR')}
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
                <div id="printable-invoice">
                    <div className="text-center mb-4 border-b border-dashed border-black pb-2">
                        <h1 className="text-xl font-black uppercase text-red-600">Extrême Buritos</h1>
                        <p>Facture: <span className="font-bold">{viewingInvoice.number}</span></p>
                        <p>Date: {new Date(viewingInvoice.created_at).toLocaleDateString()} {new Date(viewingInvoice.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        <p>Client: <span className="font-bold">{viewingInvoice.clients?.name || viewingInvoice.guest_name || 'Anonyme'}</span></p>
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
                            {viewingItems.map(item => {
                                const q = Number(item.quantity) || 0;
                                const p = item.produits || {};
                                const qpu = Number(p.quantite_par_unite) || 1;
                                const superior = Math.floor(q / qpu);
                                const base = q % qpu;
                                const priceSup = Number(p.price_superior) || 0;
                                const priceBase = Number(item.unit_price) || 0;
                                const totalLine = Number(item.total) || 0;

                                return (
                                    <tr key={item.id} className="border-b border-dashed border-gray-200 align-top">
                                        <td className="py-2 text-[8pt] font-black uppercase">{p.name}</td>
                                        <td className="py-2 text-[8pt] text-center font-black">
                                            {superior > 0 && <div>{superior}</div>}
                                            {base > 0 && <div>{base} </div>}
                                        </td>
                                        <td className="font-black py-2 text-[8pt] text-center">
                                            {superior > 0 && <div>{p.unite_superieure || 'Ctn'}</div>}
                                            {base > 0 && <div>{p.unite_base || 'Pce'}</div>}
                                        </td>
                                        <td className="py-2 text-[8pt] text-center leading-tight font-black">
                                            {superior > 0 && <div style={{ fontSize: '8pt' }}>{priceSup.toLocaleString('fr-MG')}</div>}
                                            {base > 0 && <div style={{ fontSize: '8pt' }}> {priceBase.toLocaleString('fr-MG')}</div>}
                                        </td>
                                        <td className="py-2 text-right font-black text-[8pt]">
                                            {totalLine.toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="border-t border-dashed border-black pt-2 text-right">
                        <p className="font-black text-lg mt-2 ">Net à payer: {parseFloat(viewingInvoice.total_amount).toLocaleString()} MGA</p>
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
                    <div className="text-center mt-2 text-sm border-t border-dashed border-black pt-2">
                        <p>Merci de votre confiance !</p>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

