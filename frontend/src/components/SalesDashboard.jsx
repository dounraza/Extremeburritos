import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Filter, FileText, User, TrendingUp, ShoppingCart, Clock, Tag } from 'lucide-react';
import { logAction } from '../utils/audit';

export default function SalesDashboard() {
  console.log("SalesDashboard rendu!");
  const [sales, setSales] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all'); 
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminAuthCode, setAdminAuthCode] = useState('');
  const [dbAdminCode, setDbAdminCode] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [dailyExpenses, setDailyExpenses] = useState({
    decaissements: 0,
    supplierPayments: 0,
    blPayments: 0,
    total: 0
  });

  const [financialStats, setFinancialStats] = useState({
    sales: { global: 0, monthly: 0, daily: 0 },
    purchases: { global: 0, monthly: 0, daily: 0 }
  });

  useEffect(() => {
    fetchSales();
    fetchFinancialStats();
    fetchAdminCode();
    fetchDailyExpenses(filterDate);
  }, [filterDate]);

  const fetchDailyExpenses = async (date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        // 1. Decaissements
        const { data: decData } = await supabase
            .from('decaissements')
            .select('montant')
            .eq('date_decaissement', date);

        // 2. Supplier Payments (Credits)
        const { data: payData } = await supabase
            .from('supplier_payments')
            .select('amount')
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());

        // 3. Delivery Notes (Direct sales and advances)
        const { data: blData } = await supabase
            .from('delivery_notes')
            .select('total_amount, advance_amount, payment_type')
            .gte('bl_date', startOfDay.toISOString())
            .lte('bl_date', endOfDay.toISOString());

        const totalDec = decData?.reduce((sum, d) => sum + (parseFloat(d.montant) || 0), 0) || 0;
        const totalPay = payData?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
        const totalBL = blData?.reduce((sum, bl) => {
            if (bl.payment_type === 'direct_sale') return sum + (parseFloat(bl.total_amount) || 0);
            return sum + (parseFloat(bl.advance_amount) || 0);
        }, 0) || 0;

        setDailyExpenses({
            decaissements: totalDec,
            supplierPayments: totalPay,
            blPayments: totalBL,
            total: totalDec + totalPay + totalBL
        });
    } catch (err) {
        console.error("Error fetching expenses:", err);
    }
  };

  const fetchAdminCode = async () => {
    const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'admin_code')
        .maybeSingle();
    if (data) setDbAdminCode(data.value);
  };

  const fetchFinancialStats = async () => {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    
    try {
      // SALES
      const { data: salesData } = await supabase
        .from('factures')
        .select('total_amount, created_at')
        .neq('status', 'cancelled')
        .neq('status', 'draft');

      const salesStats = { global: 0, monthly: 0, daily: 0 };
      salesData?.forEach(s => {
        const amt = parseFloat(s.total_amount) || 0;
        salesStats.global += amt;
        if (s.created_at >= startOfMonth) salesStats.monthly += amt;
        if (s.created_at >= startOfToday && s.created_at <= endOfToday) salesStats.daily += amt;
      });

      // PURCHASES (Somme des Bons de Livraison)
      const { data: purchaseData } = await supabase
        .from('delivery_notes')
        .select('total_amount, created_at');

      const purchaseStats = { global: 0, monthly: 0, daily: 0 };
      purchaseData?.forEach(p => {
        const amt = parseFloat(p.total_amount) || 0;
        purchaseStats.global += amt;
        if (p.created_at >= startOfMonth) purchaseStats.monthly += amt;
        if (p.created_at >= startOfToday && p.created_at <= endOfToday) purchaseStats.daily += amt;
      });

      setFinancialStats({
        sales: salesStats,
        purchases: purchaseStats
      });
    } catch (err) {
      console.error("Error fetching financial stats:", err);
    }
  };

  // Logic for filtering and pagination
  const filteredSales = useMemo(() => {
      let salesFiltered = sales;
      if (filterType === 'paid') {
          salesFiltered = salesFiltered.filter(s => s.type === 'COMPTANT');
      } else if (filterType === 'sent') {
          salesFiltered = salesFiltered.filter(s => s.type === 'CRÉDIT');
      }
      return salesFiltered.filter(sale => sale.number.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sales, searchTerm, filterType]);

  const paginatedSales = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  const fetchSales = async () => {
    // Get start and end of selected date in UTC
    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);

    let query = supabase
        .from('factures')
        .select('*, clients(name), facture_items(*, produits(name, unite_base, unite_superieure, quantite_par_unite)), paiements(*), remises(*)')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .neq('status', 'draft')
        .neq('status', 'cancelled');
    
    // Apply status filter
    if (filterType === 'paid') query = query.eq('status', 'paid');
    else if (filterType === 'sent') query = query.eq('status', 'sent');
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error("Error fetching sales:", error);
    if (data) {
        const enrichedSales = data.map(sale => {
            const totalAvance = sale.paiements?.filter(p => p.type_paiement === 'avance').reduce((sum, p) => sum + Number(p.montant), 0) || 0;
            const totalVersement = sale.paiements?.filter(p => p.type_paiement === 'versement').reduce((sum, p) => sum + Number(p.montant), 0) || 0;
            return { ...sale, totalAvance, totalVersement };
        });
        setSales(enrichedSales);
    }
  };

  const totals = useMemo(() => {
    return sales.reduce((acc, sale) => {
        const amount = sale.total_amount || 0;
        const avance = sale.totalAvance || 0;
        if (sale.type === 'CRÉDIT') acc.credit += amount;
        else acc.cash += amount;
        acc.daily += amount;
        acc.avances += avance;

        // Calculate discounts from the linked remises table
        if (sale.remises) {
            sale.remises.forEach(r => {
                acc.discounts += parseFloat(r.montant_calcule) || 0;
            });
        }

        return acc;
    }, { cash: 0, credit: 0, daily: 0, avances: 0, discounts: 0 });
  }, [sales]);
const handleCancelInvoice = async (invoice) => {
  if (!window.confirm("Êtes-vous sûr de vouloir annuler cette facture ? Le stock sera restauré.")) return;

  try {
      console.log("Attempting cancellation for invoice:", invoice.id);
      
      // 1. Restore stock in the correct depot
      for (const item of invoice.facture_items) {
          // Si depot_id est présent sur la facture, on restaure dans ce dépôt
          if (invoice.depot_id) {
            const { data: depotStock } = await supabase
              .from('stocks')
              .select('id, quantity')
              .eq('product_id', item.produit_id)
              .eq('depot_id', invoice.depot_id)
              .maybeSingle();

            if (depotStock) {
              await supabase.from('stocks')
                .update({ quantity: Number(depotStock.quantity) + Number(item.quantity) })
                .eq('id', depotStock.id);
            } else {
              // Si pas de stock trouvé pour ce produit dans ce dépôt, on l'insère
              await supabase.from('stocks').insert([{
                product_id: item.produit_id,
                depot_id: invoice.depot_id,
                quantity: item.quantity
              }]);
            }
          } else {
            // Fallback pour compatibilité ascendante si depot_id n'est pas sur la facture
            const { data: product } = await supabase.from('produits').select('stock_quantity').eq('id', item.produit_id).single();
            await supabase.from('produits').update({ stock_quantity: product.stock_quantity + item.quantity }).eq('id', item.produit_id);
          }
      }
      // 2. Mark invoice as cancelled
      await supabase.from('factures').update({ status: 'cancelled' }).eq('id', invoice.id);

      console.log("Logging action...");
      await logAction('Annulation Facture', 'SalesDashboard', invoice.id, { number: invoice.number });
      console.log("Action logged.");

      setSelectedInvoice(null);

      fetchSales();
  } catch (e) { 
      console.error("Cancellation error:", e);
      alert(e.message); 
  }
};

  const initiateCloseDay = () => {
    setIsAdminAuthOpen(true);
  };

  const handleCloseDay = async () => {
    if (adminAuthCode !== dbAdminCode) {
        alert("Code administrateur incorrect");
        return;
    }
    
    if (!window.confirm("Êtes-vous sûr de vouloir clôturer la journée du " + filterDate + " ? Cette action enregistrera les totaux actuels.")) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('daily_closures').insert([{
            closure_date: filterDate,
            total_cash: totals.cash,
            total_credit: totals.credit,
            total_advances: totals.avances,
            total_journalier: totals.daily,
            user_id: user.id
        }]);
        if (error) throw error;
        alert("Journée clôturée avec succès !");
        setIsAdminAuthOpen(false);
        setAdminAuthCode('');
    } catch (e) {
        alert("Erreur lors de la clôture : " + e.message);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800">Tableau de Bord</h1>
            <p className="text-slate-500 font-bold text-lg">Aujourd'hui : {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
            {new Date().getHours() >= 18 && (
                <button onClick={initiateCloseDay} className="bg-red-600 text-white font-black px-4 py-2 rounded-xl shadow-lg hover:bg-red-700 transition-all uppercase text-base">Clôturer Journée</button>
            )}
            <input type="text" placeholder="Rechercher facture..." onChange={e => setSearchTerm(e.target.value)} className="p-2 rounded-xl border border-slate-200 text-lg" />
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="p-2 rounded-xl border border-slate-200" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-2 rounded-xl border border-slate-200">
                <option value="all">Toutes les ventes</option>
                <option value="paid">Vente directe</option>
                <option value="sent">Vente à Crédit</option>
            </select>
        </div>
      </div>
      
      {/* Admin Auth Modal */}
      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl">
                <h3 className="text-2xl font-black text-gray-800 uppercase">Autorisation Admin</h3>
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
                    <button onClick={handleCloseDay} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl">Valider</button>
                </div>
            </div>
        </div>
      )}

      {/* Financial Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Sales */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-[13px] font-black uppercase text-red-600 tracking-wider mb-2">Ventes (Global/Mois/Jour)</h3>
            <p className="text-2xl font-black text-slate-800">{financialStats.sales.global.toLocaleString()} Ar</p>
            <div className="flex gap-4 mt-2 text-[13px] font-bold text-slate-500">
                <span>Mois: {financialStats.sales.monthly.toLocaleString()}</span>
                <span>Jour: {financialStats.sales.daily.toLocaleString()}</span>
            </div>
        </div>

        {/* Purchases */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
            <h3 className="text-[13px] font-black uppercase text-blue-600 tracking-wider mb-2">Achats (Global/Mois/Jour)</h3>
            <p className="text-2xl font-black text-slate-800">{financialStats.purchases.global.toLocaleString()} Ar</p>
            <div className="flex gap-4 mt-2 text-[13px] font-bold text-slate-500">
                <span>Mois: {financialStats.purchases.monthly.toLocaleString()}</span>
                <span>Jour: {financialStats.purchases.daily.toLocaleString()}</span>
            </div>
        </div>

        {/* Filtered Context (Expenses) */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[13px] font-black uppercase text-slate-600 tracking-wider mb-2">Détails Dépenses (Filtre)</h3>
            <div className="grid grid-cols-1 gap-1 mt-2 text-[12px] font-bold text-slate-500">
                <span className="text-red-500 font-black">Décaissements: {dailyExpenses.decaissements.toLocaleString()} Ar</span>
                <span className="text-orange-500 font-black">Crédits Fourn.: {dailyExpenses.supplierPayments.toLocaleString()} Ar</span>
                <span className="text-blue-500 font-black">Achats Directs/Avances: {dailyExpenses.blPayments.toLocaleString()} Ar</span>
                <div className="mt-1 pt-1 border-t border-slate-100 text-slate-800 font-black text-sm">
                    Total Dépenses: {dailyExpenses.total.toLocaleString()} Ar
                </div>
                <div className="mt-2 pt-1 border-t border-dashed border-gray-100 text-red-600 font-black text-sm">
                    Total Remises Sales: {totals.discounts.toLocaleString()} Ar
                </div>
            </div>
        </div>
        
        {/* Today's Context (Results) */}
        <div className="bg-gray-900 text-white p-6 rounded-3xl shadow-lg">
            <h3 className="text-[13px] font-black uppercase text-red-400 tracking-wider mb-2">Résultat du {new Date(filterDate).toLocaleDateString()}</h3>
            <div className="space-y-2 mt-2">
                <div className="flex justify-between items-center">
                    <span className="text-red-400 text-xs uppercase font-black">Recettes (Ventes)</span>
                    <span className="text-lg font-black">{totals.daily.toLocaleString()} Ar</span>
                </div>
                <div className="pl-4 space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-bold text-gray-400 uppercase">

                        <span>• Ventes Comptant</span>
                        <span>{totals.cash.toLocaleString()} Ar</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-bold text-orange-400 uppercase">
                        <span>• Ventes Crédit</span>
                        <span>{totals.credit.toLocaleString()} Ar</span>
                    </div>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-orange-300 text-xs uppercase font-black">Remises Accordées</span>
                    <span className="text-lg font-black">{totals.discounts.toLocaleString()} Ar</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-red-400 text-xs uppercase font-black">Dépenses</span>
                    <span className="text-lg font-black">-{dailyExpenses.total.toLocaleString()} Ar</span>
                </div>
                <div className="pt-2 border-t border-red-800 flex justify-between items-center">
                    <span className="text-red-400 text-[13px] font-black uppercase">Résultat Net</span>
                    <span className={`text-2xl font-black ${totals.daily - dailyExpenses.total >= 0 ? 'text-white' : 'text-red-400'}`}>
                        {(totals.daily - dailyExpenses.total).toLocaleString()} Ar
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* Table Filters Bar */}
      <div className="bg-white p-4 rounded-t-3xl border-x border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between shadow-sm">
          <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                  <FileText size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                      type="text" 
                      placeholder="Rechercher par numéro de facture..." 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                      onChange={e => setSearchTerm(e.target.value)} 
                  />
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                  <Calendar size={18} className="text-red-600" />
                  <input 
                      type="date" 
                      value={filterDate} 
                      onChange={e => setFilterDate(e.target.value)} 
                      className="bg-transparent font-black text-slate-700 outline-none py-1" 
                  />
              </div>
          </div>
          <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <select 
                  value={filterType} 
                  onChange={e => setFilterType(e.target.value)} 
                  className="bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition-colors"
              >
                  <option value="all">Toutes les ventes</option>
                  <option value="paid">Vente directe</option>
                  <option value="sent">Vente à Crédit</option>
              </select>
          </div>
      </div>

      <div className="bg-white rounded-b-3xl shadow-sm border border-slate-100 overflow-hidden overflow-y-auto max-h-[70vh]">
        <div className="min-w-[700px]">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[16px] font-black border-b border-slate-100">
                <tr>
                    <th className="p-4">Facture</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Détails</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {paginatedSales.map(sale => (
                    <tr key={sale.id} className="text-[15px] font-bold text-slate-700">
                        <td className="p-4">{sale.number}</td>
                        <td className="p-4 text-[16px]">
                          {new Date(sale.created_at).toLocaleDateString('fr-FR')} {new Date(sale.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="p-4">{sale.clients?.name || sale.guest_name || 'Anonyme'}</td>
                        <td className="p-4">
                            <button 
                                onClick={() => setSelectedInvoice(sale)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-[16px] font-black uppercase transition-all"
                            >
                                Voir détails
                            </button>
                        </td>
                        <td className="p-4 uppercase font-black text-[16px]">
                            {sale.type === 'CRÉDIT' ? (
                                <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">Crédit</span>
                            ) : (
                                <span className="text-red-600 bg-gray-50 px-2 py-1 rounded-lg">Comptant</span>
                            )}
                        </td>
                        <td className="p-4 text-right">{sale.total_amount.toLocaleString()} Ar</td>
                    </tr>
                ))}
            </tbody>
        </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-4 py-2 bg-slate-100 rounded-lg text-base font-black">Précédent</button>
                <span className="px-4 py-2 text-base font-black text-slate-500">Page {currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-4 py-2 bg-slate-100 rounded-lg text-base font-black">Suivant</button>
            </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">Facture: {selectedInvoice.number}</h3>
                        <p className="text-lg font-bold text-slate-600">Date: {new Date(selectedInvoice.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-lg font-bold text-slate-600">Client: {selectedInvoice.clients?.name || selectedInvoice.guest_name || 'Anonyme'}</p>
                        <p className="text-lg font-bold text-slate-600">Contact: {selectedInvoice.guest_contact || 'Non renseigné'}</p>
                    </div>
                    <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-800">Fermer</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-base">
                        <thead className="text-slate-400 uppercase font-black border-b border-slate-100">
                            <tr>
                                <th className="p-2">Désignation</th>
                                <th className="p-2 text-center">Qté</th>
                                <th className="p-2 text-center">Unités</th>
                                <th className="p-2 text-center">Remise</th>
                                <th className="p-2 text-right">P.U</th>
                                <th className="p-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {selectedInvoice.facture_items?.map(item => (
                                <tr key={item.id} className="text-slate-800 font-bold">
                                    <td className="p-2 uppercase">{item.produits?.name}</td>
                                    <td className="p-2 text-center">{item.quantity || 0}</td>
                                    <td className="p-2 text-center text-[15px] text-slate-500 italic">
                                        {item.produits && item.produits.quantite_par_unite > 1 ? 
                                            `${Math.floor((item.quantity || 0) / item.produits.quantite_par_unite)} ${item.produits.unite_superieure || 'Ctn'} + ${(item.quantity || 0) % item.produits.quantite_par_unite} ${item.produits.unite_base || 'Pce'}` 
                                            : `${item.quantity || 0} ${item.produits?.unite_base || 'Pce'}`
                                        }
                                    </td>
                                    <td className="p-2 text-center text-orange-600">
                                        {item.discount_value ? `${item.discount_value}${item.discount_type || ''}` : '-'}
                                    </td>
                                    <td className="p-2 text-right">{(item.unit_price || 0).toLocaleString()} Ar</td>
                                    <td className="p-2 text-right font-black">
                                        {(( (item.quantity || 0) * (item.unit_price || 0) ) - (item.discount_value ? (item.discount_type === '%' ? ((item.quantity || 0) * (item.unit_price || 0)) * (item.discount_value/100) : item.discount_value) : 0)).toLocaleString()} Ar
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                    {selectedInvoice.remises && selectedInvoice.remises.length > 0 && (
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <h4 className="text-orange-800 font-black uppercase text-sm mb-2 flex items-center gap-2">
                                <Tag size={14} /> Détails des Remises
                            </h4>
                            <div className="space-y-1">
                                {selectedInvoice.remises.map(r => (
                                    <div key={r.id} className="flex justify-between text-sm font-bold text-orange-700">
                                        <span>• {r.type_remise === 'global' ? 'Remise Globale' : `Remise Produit`}</span>
                                        <span>-{parseFloat(r.montant_calcule).toLocaleString()} Ar</span>
                                    </div>
                                ))}
                                <div className="pt-2 mt-1 border-t border-orange-200 flex justify-between font-black text-orange-900">
                                    <span>TOTAL REMISES</span>
                                    <span>-{selectedInvoice.remises.reduce((sum, r) => sum + (parseFloat(r.montant_calcule) || 0), 0).toLocaleString()} Ar</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-lg font-bold text-slate-700 bg-slate-100 p-3 rounded-xl">
                        <span>Avances totales:</span>
                        <span className="font-black text-red-600">{selectedInvoice.totalAvance.toLocaleString()} Ar</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-lg font-bold text-slate-700 bg-gray-100 p-3 rounded-xl border-2 border-emerald-200">
                        <span>NET À PAYER (Total - Remise):</span>
                        <span className="font-black text-red-800">{selectedInvoice.total_amount.toLocaleString()} Ar</span>
                    </div>
                    <button 
                        onClick={() => handleCancelInvoice(selectedInvoice)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white p-4 rounded-xl font-black text-lg uppercase shadow-md transition-all"
                    >
                        Annuler la facture
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

