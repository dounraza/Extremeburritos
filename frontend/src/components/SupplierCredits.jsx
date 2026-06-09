import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Truck, Search, Loader2, Banknote, ChevronDown, ChevronUp } from 'lucide-react';
import { logAction } from '../utils/audit';

export default function SupplierCredits() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [paymentModal, setPaymentModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('espece');
  const [paymentRef, setPaymentRef] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    setLoading(true);
    const { data: notes, error: notesError } = await supabase
      .from('delivery_notes')
      .select('*, fournisseurs!delivery_notes_supplier_id_fkey(name)')
      .eq('payment_type', 'credit')
      .order('due_date', { ascending: true });
    
    if (notes) {
        // 1. Fetch items
        const { data: items } = await supabase.from('delivery_note_items').select('*');
        // 2. Fetch all products
        const { data: produits } = await supabase.from('produits').select('*');
        // 3. Fetch payments
        const { data: payments } = await supabase.from('paiements').select('*').not('delivery_note_id', 'is', null);
        
        // Join items with their respective products manually
        const itemsWithProducts = items?.map(item => ({
            ...item,
            produits: produits?.find(p => p.id === item.product_id)
        })) || [];
        
        const enrichedCredits = notes.map(n => ({
            ...n,
            delivery_note_items: itemsWithProducts.filter(i => String(i.delivery_note_id) === String(n.id)) || [],
            paiements: payments?.filter(p => String(p.delivery_note_id) === String(n.id)) || []
        }));
        setCredits(enrichedCredits);
    }
    
    if (notesError) console.error("Erreur récupération crédits:", notesError);
    setLoading(false);
  };

  const processPayment = async () => {
    if(!paymentModal) return;
    const amountToPay = parseFloat(paymentAmount);
    if(isNaN(amountToPay) || amountToPay <= 0) return alert("Montant invalide");
    if(amountToPay > paymentModal.total_amount) return alert("Montant supérieur au reste à payer");

    const newTotal = paymentModal.total_amount - amountToPay;
    
    // 1. Update the delivery note
    const { error: updateError } = await supabase
        .from('delivery_notes')
        .update({ 
            total_amount: newTotal,
            payment_type: newTotal <= 0 ? 'paid' : 'credit'
        })
        .eq('id', paymentModal.id);

    if (!updateError) {
        // 2. Log the payment record
        await supabase.from('paiements').insert([{
            facture_id: null,
            delivery_note_id: paymentModal.id,
            montant: amountToPay,
            type_paiement: paymentMethod,
            reference: paymentRef,
            date_paiement: new Date().toISOString()
        }]);

        // 3. Log to history
        await logAction('Paiement Crédit Fournisseur', 'SupplierCredits', paymentModal.id, { 
            bl_number: paymentModal.bl_number,
            montant: amountToPay,
            methode: paymentMethod,
            reference: paymentRef
        });

        setPaymentModal(null);
        setPaymentAmount(0);
        setPaymentRef('');
        setPaymentMethod('espece');
        fetchCredits();
    } else alert("Erreur lors du paiement");
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCredits = credits.filter(c => 
    (c.bl_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.fournisseurs?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = useMemo(() => {
    // Calcul strict du total initial des BL
    const totalCredit = filteredCredits.reduce((acc, c) => {
        const montant = parseFloat(c.total_initial) || parseFloat(c.total_amount) || 0;
        return acc + montant;
    }, 0);

    // Calcul du solde restant (montant actuel)
    const totalRemaining = filteredCredits.reduce((acc, c) => acc + (parseFloat(c.total_amount) || 0), 0);

    // Total Payé
    const totalPaid = filteredCredits.reduce((acc, c) => {
        const paid = (c.paiements || []).reduce((pAcc, p) => pAcc + (parseFloat(p.montant) || 0), 0);
        return acc + paid;
    }, 0);
    return { totalCredit, totalRemaining, totalPaid };
  }, [filteredCredits]);
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
            <span className="text-[16px] font-black uppercase text-gray-400">Total Initial</span>
            <span className="text-2xl font-black text-red-800">{totals.totalCredit.toLocaleString()} Ar</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
            <span className="text-[16px] font-black uppercase text-gray-400">Total Payé</span>
            <span className="text-2xl font-black text-red-600">{totals.totalPaid.toLocaleString()} Ar</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
            <span className="text-[16px] font-black uppercase text-gray-400">Solde Restant</span>
            <span className="text-2xl font-black text-orange-600">{totals.totalRemaining.toLocaleString()} Ar</span>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
        <h2 className="text-3xl font-black text-red-800 flex items-center gap-2">
            <Truck className="text-red-600" /> Suivi des Crédits Fournisseurs
        </h2>
        <input 
          type="text" 
          placeholder="Rechercher..." 
          className="p-2 border rounded-xl w-64 text-lg"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
        {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-500" /></div>
        ) : (
            <table className="w-full text-lg text-left">
                <thead className="bg-gray-50 text-red-800 uppercase text-[16px] font-black">
                    <tr>
                        <th className="p-4">BL</th>
                        <th className="p-4">Fournisseur</th>
                        <th className="p-4">Échéance</th>
                        <th className="p-4 text-right">Montant Initial</th>
                        <th className="p-4 text-right">Reste à Payer</th>
                        <th className="p-4 text-center">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {filteredCredits.map(c => {
                        const isOverdue = new Date(c.due_date) < new Date();
                        return (
                        <>
                            <tr key={c.id} className={`hover:bg-gray-50/30 cursor-pointer ${isOverdue ? 'bg-red-50/20' : ''}`} onClick={() => toggleRow(c.id)}>
                                <td className="p-4 font-bold flex items-center gap-2">
                                    {expandedRows[c.id] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    {c.bl_number || 'N/A'}
                                </td>
                                <td className="p-4 font-bold">{c.fournisseurs?.name || 'Inconnu'}</td>
                                <td className={`p-4 font-bold ${isOverdue ? 'text-red-600' : ''}`}>
                                    {new Date(c.due_date).toLocaleDateString()}
                                </td>
                                <td className="p-4 font-bold text-right text-gray-600">{parseFloat(c.total_initial || c.total_amount).toLocaleString()} Ar</td>
                                <td className="p-4 font-black text-right text-red-800">{parseFloat(c.total_amount).toLocaleString()} Ar</td>
                                <td className="p-4 text-center">
                                    <div className="flex gap-2 justify-center">
                                        <button onClick={(e) => { e.stopPropagation(); setHistoryModal(c); }} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg font-bold text-base uppercase flex items-center gap-1">
                                            Historique
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setPaymentModal(c); }} className="bg-red-600 text-white px-3 py-1 rounded-lg font-bold text-base uppercase flex items-center gap-1">
                                            <Banknote size={14} /> Payer
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            {expandedRows[c.id] && (
                                <tr className="bg-gray-50">
                                    <td colSpan="5" className="p-4 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white p-3 rounded-lg border">
                                                <h4 className="text-[16px] uppercase font-black text-gray-400 mb-2">Produits</h4>
                                                <table className="w-full text-base">
                                                    <thead>
                                                        <tr className="text-gray-400">
                                                            <th className="p-1 text-left">Produit</th>
                                                            <th className="p-1 text-center">Qté</th>
                                                            <th className="p-1 text-center">Unité</th>
                                                            <th className="p-1 text-right">P.A</th>
                                                            <th className="p-1 text-right">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                    {(c.delivery_note_items || []).map((item, idx) => (
                                                        <tr key={idx} className="border-t">
                                                            <td className="p-1 font-medium">{item.produits?.name || 'Inconnu'}</td>
                                                            <td className="p-1 text-center font-bold">{item.quantity}</td>
                                                            <td className="p-1 text-center text-[16px] uppercase font-bold text-red-600">{item.unit === 'superior' ? (item.superior_unit_name || 'Ctn') : (item.produits?.unite_base || 'Pce')}</td>
                                                            <td className="p-1 text-right">{parseFloat(item.purchase_price_per_unit).toLocaleString()} Ar</td>
                                                            <td className="p-1 text-right font-black">{parseFloat(item.line_total_purchase).toLocaleString()} Ar</td>
                                                        </tr>
                                                    ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border">
                                                <h4 className="text-[16px] uppercase font-black text-gray-400 mb-2">Historique Paiements</h4>
                                                <table className="w-full text-base">
                                                    <tbody>
                                                    {(c.paiements || []).map((p, idx) => (
                                                        <tr key={idx} className="border-t">
                                                            <td className="p-1 text-[15px] font-bold text-gray-500">{new Date(p.date_paiement).toLocaleDateString()}</td>
                                                            <td className="p-1 font-bold">{p.montant.toLocaleString()} Ar</td>
                                                            <td className="p-1 text-right uppercase text-[15px]">{p.type_paiement}</td>
                                                        </tr>
                                                    ))}
                                                    {(c.paiements || []).length === 0 && <tr className="text-gray-400 italic"><td>Aucun paiement</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </>
                    )})}
                </tbody>
                <tfoot className="bg-gray-50">
                    <tr>
                        <td colSpan="3" className="p-4 font-black text-red-800 uppercase text-base text-right">Total Général (Initial)</td>
                        <td className="p-4 font-black text-red-800 text-right">{totals.totalCredit.toLocaleString()} Ar</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        )}
      </div>
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl">
                <h3 className="font-black text-red-800 text-2xl mb-4">Historique des paiements - {historyModal.bl_number}</h3>
                <div className="max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-base">
                        <thead className="bg-gray-50 text-gray-400 uppercase">
                            <tr><th className="p-2 text-left">Date</th><th className="p-2 text-right">Montant</th><th className="p-2 text-right">Méthode</th></tr>
                        </thead>
                        <tbody>
                            {(historyModal.paiements || []).map((p, idx) => (
                                <tr key={idx} className="border-t">
                                    <td className="p-2">{new Date(p.date_paiement).toLocaleDateString()}</td>
                                    <td className="p-2 text-right font-bold">{p.montant.toLocaleString()} Ar</td>
                                    <td className="p-2 text-right uppercase">{p.type_paiement}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={() => setHistoryModal(null)} className="w-full py-3 mt-4 bg-gray-600 text-white rounded-xl font-black text-lg">Fermer</button>
            </div>
        </div>
      )}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-red-800 text-2xl mb-4">Paiement du crédit</h3>
            <p className="text-base font-bold text-gray-500 mb-6">Reste à payer : {paymentModal.total_amount.toLocaleString()} Ar</p>
            <input 
              type="number" 
              className="w-full p-3 border-2 border-gray-100 rounded-xl mb-3 font-black"
              placeholder="Montant à payer"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <select className="w-full p-3 border-2 border-gray-100 rounded-xl mb-3 font-bold text-lg" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="espece">Espèce</option>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="mobile_money">Mobile Money</option>
            </select>
            <input 
              type="text" 
              className="w-full p-3 border-2 border-gray-100 rounded-xl mb-4 font-bold text-lg"
              placeholder="Référence (Optionnel)"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
            <div className="flex gap-3">
                <button onClick={() => setPaymentModal(null)} className="flex-1 py-3 text-lg font-bold text-gray-500">Annuler</button>
                <button onClick={processPayment} disabled={isPaying} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-lg flex items-center justify-center gap-2">
                    {isPaying ? <Loader2 size={16} className="animate-spin" /> : "Confirmer"}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

