import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle2, AlertCircle, Search, FileText, ChevronDown, ChevronUp, Printer, X } from 'lucide-react';

export default function CreditHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, paid
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const toggleExpand = (id) => {
    setExpandedInvoices(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('factures')
        .select(`
          *,
          clients!factures_client_id_fkey (name, phone),
          paiements(*),
          echeances_details(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const creditFactures = data?.filter(f => f.type === 'CRÉDIT' || f.type === 'CREDIT');
      setHistory(creditFactures || []);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = history.filter(h => {
    const matchesSearch = h.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (h.clients?.name || h.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'paid') return h.status === 'paid';
    if (statusFilter === 'pending') return h.status !== 'paid';
    return true;
  });

  const totals = useMemo(() => {
    const totalCredit = filtered.reduce((acc, h) => acc + (parseFloat(h.total_amount) || 0), 0);
    const totalPaid = filtered.reduce((acc, h) => {
        const paid = (h.paiements || []).reduce((pAcc, p) => pAcc + (parseFloat(p.montant) || 0), 0);
        return acc + paid;
    }, 0);
    return { totalCredit, totalPaid };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
            <span className="text-[16px] font-black uppercase text-gray-400">Montant Global Crédits</span>
            <span className="text-2xl font-black text-red-800">{totals.totalCredit.toLocaleString()} Ar</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
            <span className="text-[16px] font-black uppercase text-gray-400">Total Payé</span>
            <span className="text-2xl font-black text-red-600">{totals.totalPaid.toLocaleString()} Ar</span>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-white/60 backdrop-blur-md p-3 rounded-2xl border border-gray-50/50 gap-4 shadow-sm no-print">
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" size={16} />
            <input 
              type="text" 
              placeholder="Rechercher par n° de facture ou client..." 
              className="w-full bg-white border border-gray-100/50 rounded-xl py-2 pl-10 pr-4 text-base outline-none focus:ring-4 focus:ring-red-500/20 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex bg-gray-50/30 p-1 rounded-xl border border-gray-100/50">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'pending', label: 'En cours' },
              { id: 'paid', label: 'Soldés' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-[15px] font-bold uppercase tracking-wider transition-all ${statusFilter === tab.id ? 'bg-red-600 text-white shadow-sm' : 'text-red-600/70 hover:bg-gray-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 text-red-600 rounded-xl text-[16px] font-bold uppercase hover:bg-gray-50 transition-all shadow-sm no-print"
        >
            <Printer size={16} /> Imprimer la liste
        </button>
      </div>

      <div className="bg-white/70 backdrop-blur-md border border-gray-50/50 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/20 border-b border-gray-50/50">
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest">Facture</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest">Date</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest">Client</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-right">Crédit</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-right">Avances</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-center">Détails</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-right">Reste</th>
              <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50/30">
            {loading ? (
                <tr><td colSpan="8" className="p-8 text-center text-[16px] font-bold text-gray-400">Chargement...</td></tr>
            ) : filtered.length > 0 ? (
                filtered.map((inv) => {
                    const totalPaid = inv.paiements?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
                    const totalDue = Number(inv.total_amount || 0);
                    const isFullyPaid = totalPaid >= totalDue;
                    const isExpanded = expandedInvoices[inv.id];
                    const lastPayment = inv.paiements?.slice(-1)[0];

                    return (
                        <>
                            <tr key={inv.id} className={`hover:bg-gray-50/10 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/5' : ''}`} onClick={() => toggleExpand(inv.id)}>
                                <td className="p-4 font-bold text-gray-700 text-base uppercase">{inv.number}</td>
                                <td className="p-4 text-[16px] font-medium text-gray-400 uppercase tracking-tight">
                                    {new Date(inv.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-[16px] font-medium text-gray-400 uppercase tracking-tight">{inv.clients?.name || inv.guest_name}</td>
                                <td className="p-4 font-bold text-gray-700 text-right text-base">{totalDue.toLocaleString()} Ar</td>
                                <td className="p-4 font-bold text-red-600 text-right text-base">{totalPaid.toLocaleString()} Ar</td>
                                <td className="p-4 text-center">
                                    {lastPayment && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setSelectedInvoice(inv); }}
                                          className="text-[14px] font-bold uppercase bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:text-red-600 transition-colors px-2 py-1 rounded-md"
                                        >
                                          {lastPayment.method || lastPayment.type_paiement}
                                        </button>
                                    )}
                                </td>
                                <td className="p-4 font-bold text-orange-600 text-right text-base">{(totalDue - totalPaid).toLocaleString()} Ar</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-lg text-[14px] font-bold uppercase ${isFullyPaid ? 'bg-gray-100 text-red-600' : 'bg-orange-100 text-orange-700'}`}>
                                        {isFullyPaid ? 'Soldé' : 'En cours'}
                                    </span>
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-gray-50/30">
                                    <td colSpan="8" className="p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {inv.paiements?.map((p, idx) => (
                                                <div key={p.id} className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                                                    <p className="text-[13px] font-bold text-gray-400 uppercase">Paiement #{idx + 1} - {new Date(p.date_paiement).toLocaleDateString()}</p>
                                                    <p className="text-[17px] font-bold text-gray-800">{Number(p.montant).toLocaleString()} Ar</p>
                                                    <span className="text-[13px] uppercase font-bold text-red-600">{p.method || p.type_paiement}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </>
                    );
                })
            ) : (
                <tr><td colSpan="8" className="p-8 text-center text-[16px] font-bold text-gray-400">Aucun historique trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Détails Paiements */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-50">
            <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900 uppercase tracking-widest">Détails des Avances</h3>
                <p className="text-[15px] font-medium text-red-600/80 uppercase mt-1">{selectedInvoice.number}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-gray-400 hover:text-red-500 shadow-sm transition-all no-print"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <button 
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 border border-slate-100 text-slate-600 rounded-xl text-[16px] font-bold uppercase hover:bg-slate-100 transition-all no-print"
              >
                <Printer size={14} /> Imprimer l'historique
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50/30 p-3 rounded-2xl border border-gray-100/50">
                  <p className="text-[13px] font-bold text-red-800 uppercase mb-1">Global</p>
                  <p className="text-base font-bold text-gray-900">{Number(selectedInvoice.total_amount).toLocaleString()} Ar</p>
                </div>
                <div className="bg-red-600 p-3 rounded-2xl shadow-md shadow-red-200/50">
                  <p className="text-[13px] font-bold text-gray-100 uppercase mb-1">Payé</p>
                  <p className="text-base font-bold text-white">
                    {selectedInvoice.paiements?.reduce((sum, p) => sum + Number(p.montant), 0).toLocaleString()} Ar
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {selectedInvoice.paiements?.length > 0 ? (
                  selectedInvoice.paiements.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100/50 hover:bg-white transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[14px] font-bold text-gray-400 group-hover:text-red-600 group-hover:border-gray-100 transition-all">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-[17px] font-bold text-gray-700">{Number(p.montant).toLocaleString()} Ar</p>
                          <p className="text-[14px] font-medium text-gray-400 uppercase">{new Date(p.date_paiement).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[13px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-red-600 rounded-md block mb-0.5">
                          {p.method || p.type_paiement}
                        </span>
                        {p.reference && <p className="text-[12px] font-medium text-gray-400 uppercase truncate max-w-[50px]">{p.reference}</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-10 text-[16px] font-bold text-gray-400 uppercase tracking-widest">Aucun paiement enregistré</p>
                )}
              </div>
              
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200/50 hover:bg-red-700 transition-all text-[16px] uppercase tracking-widest mt-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

