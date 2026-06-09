import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Clock, User, AlertCircle, CheckCircle, Search, FileText, List, LayoutGrid, Table, DollarSign, Loader2, X, CheckCircle2, Banknote, ChevronLeft, ChevronRight, Printer } from 'lucide-react';

export default function Deadlines({ initialSearchTerm, onSearchReset }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'table', 'calendar'
  const [frequencyFilter, setFrequencyFilter] = useState('all'); // 'all', 'day', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());

  const [paymentModal, setPaymentModal] = useState(null); // { echeance: ... }
  const [selectedInvoiceHistory, setSelectedInvoiceHistory] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState({
    method: '', // Initialisé à vide pour forcer le choix
    reference: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalAdvancesToday, setTotalAdvancesToday] = useState(0);
  const [totalCreditRemaining, setTotalCreditRemaining] = useState(0);
  const [totalCreditSales, setTotalCreditSales] = useState(0);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('echeances_details')
        .select(`
          *,
          factures (
            number,
            guest_name,
            total_amount,
            clients (name, phone),
            paiements(*)
          )
        `)
        .order('date_echeance', { ascending: true });
      
      if (error) {
        console.error("Error fetching deadlines:", error);
      }
      if (data) {
        // Calculer les totaux pour chaque échéance/facture
        let todaySum = 0;
        let creditTotal = 0;
        let salesTotal = 0;
        const processedFactures = new Set();
        const todayStr = new Date().toLocaleDateString();

        const enriched = data.map(d => {
            const totalPaid = d.factures?.paiements?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
            
            // Calculer le total des avances d'aujourd'hui
            d.factures?.paiements?.forEach(p => {
                if (new Date(p.date_paiement).toLocaleDateString() === todayStr) {
                    todaySum += Number(p.montant);
                }
            });

            // Cumuler le reste à payer global
            if (d.statut === 'non_paye') {
                creditTotal += Number(d.montant || 0);

                // Cumuler le CA Crédit global (original)
                if (d.factures && !processedFactures.has(d.facture_id)) {
                    processedFactures.add(d.facture_id);
                    salesTotal += Number(d.factures.total_amount || 0);
                }
            }

            return { ...d, totalPaid };
        });
        setDeadlines(enriched);
        setTotalAdvancesToday(todaySum);
        setTotalCreditRemaining(creditTotal);
        setTotalCreditSales(salesTotal);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const [paymentAmount, setPaymentAmount] = useState(0);

  const handleMarkAsPaid = async () => {
    if (!paymentModal || !paymentModal.echeance) return;
    const { echeance } = paymentModal;
    
    // Calcul du montant réel à payer (input utilisateur vs dû)
    const amountToPay = Number(paymentAmount) > 0 ? Number(paymentAmount) : echeance.montant;

    // Validation : montant
    if (amountToPay > echeance.montant) {
      alert("Le montant saisi dépasse le montant dû de cette échéance.");
      return;
    }

    // Validation : Moyen de paiement obligatoire
    if (!paymentInfo.method) {
      alert("Veuillez sélectionner un moyen de paiement.");
      return;
    }
    
    setIsProcessing(true);
    try {
      // Générer une référence automatique pour l'espèce si vide
      let finalReference = paymentInfo.reference;
      if (paymentInfo.method === 'esp' && !finalReference) {
        finalReference = `CASH-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      }

      // 1. Enregistrer le paiement
      const { error: paiementError } = await supabase
        .from('paiements')
        .insert([{
          facture_id: echeance.facture_id,
          montant: amountToPay,
          type_paiement: 'versement',
          method: paymentInfo.method,
          reference: finalReference,
          date_paiement: new Date().toISOString()
        }]);
      
      if (paiementError) throw paiementError;

      // 2. Mettre à jour l'échéance
      const nouveauReste = echeance.montant - amountToPay;
      if (nouveauReste <= 0) {
        await supabase
          .from('echeances_details')
          .update({ statut: 'paye', montant: 0 })
          .eq('id', echeance.id);
      } else {
        // Optionnel : soit on réduit le montant de l'échéance actuelle, soit on crée une nouvelle ligne.
        // Ici on réduit le montant dû de l'échéance.
        await supabase
          .from('echeances_details')
          .update({ montant: nouveauReste })
          .eq('id', echeance.id);
      }
      
      // 3. Vérifier si toutes les échéances de cette facture sont payées
      const { data: remaining } = await supabase
        .from('echeances_details')
        .select('id')
        .eq('facture_id', echeance.facture_id)
        .eq('statut', 'non_paye');

      if (remaining && remaining.length === 0) {
        await supabase.from('factures').update({ status: 'paid' }).eq('id', echeance.facture_id);
      }
      
      setPaymentModal(null);
      setPaymentAmount(0);
      setPaymentInfo({ method: 'espece', reference: '' });
      fetchDeadlines();
      alert("Paiement enregistré avec succès !");
    } catch (err) {
      alert("Erreur lors de l'enregistrement du paiement : " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = deadlines.filter(d => {
    const matchesSearch = d.factures?.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.factures?.clients?.name || d.factures?.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = d.statut === 'non_paye'; // On montre surtout les non payés par défaut dans l'échéancier
    
    const matchesDate = !dateFilter || d.date_echeance === dateFilter;

    if (frequencyFilter === 'all') return matchesSearch && matchesStatus && matchesDate;

    const siblingInstallments = deadlines.filter(sib => sib.facture_id === d.facture_id);
    if (siblingInstallments.length <= 1) return matchesSearch && matchesStatus;

    const dates = siblingInstallments.map(sib => new Date(sib.date_echeance).getTime()).sort();
    const gaps = [];
    for(let i=1; i<dates.length; i++) gaps.push((dates[i] - dates[i-1]) / (1000 * 3600 * 24));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    const isDaily = avgGap < 15;
    return matchesSearch && matchesStatus && (frequencyFilter === 'day' ? isDaily : !isDaily);
  });

  // Groupement par facture pour la vue "Cards"
  const groupedInvoices = filtered.reduce((acc, current) => {
    const factId = current.facture_id;
    if (!acc[factId]) {
      acc[factId] = {
        facture_id: factId,
        number: current.factures?.number,
        client_name: current.factures?.clients?.name || current.factures?.guest_name || 'Client Direct',
        total_amount: current.factures?.total_amount || 0,
        total_remaining: 0,
        installments: [],
        next_due_date: current.date_echeance,
        is_daily: false,
        full_facture: current.factures // Garder une référence pour le modal de détails
      };
    }
    acc[factId].total_remaining += current.montant;
    acc[factId].installments.push(current);
    
    if (new Date(current.date_echeance) < new Date(acc[factId].next_due_date)) {
      acc[factId].next_due_date = current.date_echeance;
    }
    return acc;
  }, {});

  const groupedList = Object.values(groupedInvoices).map(inv => {
    if (inv.installments.length > 1) {
      const dates = inv.installments.map(sib => new Date(sib.date_echeance).getTime()).sort();
      const gap = (dates[1] - dates[0]) / (1000 * 3600 * 24);
      inv.is_daily = gap < 15;
    }
    return inv;
  }).sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));

  // Calendar Logic
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDay: (firstDay === 0 ? 6 : firstDay - 1), days };
  };
  const { firstDay, days } = getDaysInMonth(currentDate);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Résumé Today */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-slate-700 p-5 rounded-3xl shadow-lg shadow-slate-100 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative">
                <p className="text-[16px] font-bold text-slate-300 uppercase tracking-widest mb-1">Ventes à Crédit</p>
                <p className="text-[14px] font-medium text-slate-400 uppercase tracking-[0.2em]">Valeur Initiale</p>
            </div>
            <p className="text-3xl font-bold text-white mt-4 relative">{totalCreditSales.toLocaleString()} Ar</p>
        </div>

        <div className="bg-orange-500 p-5 rounded-3xl shadow-lg shadow-orange-100/50 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative">
                <p className="text-[16px] font-bold text-orange-50 uppercase tracking-widest mb-1">Crédit Restant</p>
                <p className="text-[14px] font-medium text-orange-100 uppercase tracking-[0.2em]">À recouvrer</p>
            </div>
            <p className="text-3xl font-bold text-white mt-4 relative">{totalCreditRemaining.toLocaleString()} Ar</p>
        </div>
        
        <div className="bg-red-600 p-5 rounded-3xl shadow-lg shadow-red-200/50 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative">
                <p className="text-[16px] font-bold text-gray-100 uppercase tracking-widest mb-1">Total des Avances</p>
                <p className="text-[14px] font-medium text-gray-400 uppercase tracking-[0.2em]">Aujourd'hui</p>
            </div>
            <p className="text-3xl font-bold text-white mt-4 relative">{totalAdvancesToday.toLocaleString()} Ar</p>
        </div>
        
        <div className="bg-white/70 backdrop-blur-md p-5 rounded-3xl border border-gray-50/50 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-red-600">
                    <CalendarIcon size={16} />
                </div>
                <div>
                    <p className="text-[15px] font-bold text-gray-400 uppercase tracking-widest">Date</p>
                    <input 
                        type="date" 
                        className="bg-transparent border-none outline-none font-bold text-gray-900 text-base p-0 h-auto cursor-pointer"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    />
                </div>
            </div>
            {dateFilter && (
                <button 
                    onClick={() => setDateFilter('')}
                    className="text-[15px] font-bold text-red-500 uppercase tracking-widest hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                >
                    Effacer
                </button>
            )}
        </div>
      </div>

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
            {['all', 'day', 'month'].map(f => (
              <button 
                key={f}
                onClick={() => setFrequencyFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[15px] font-bold uppercase tracking-wider transition-all ${frequencyFilter === f ? 'bg-red-600 text-white shadow-sm' : 'text-red-600/70 hover:bg-gray-50'}`}
              >
                {f === 'all' ? 'Tous' : f === 'day' ? 'Journalier' : 'Mensuel'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 text-red-600 rounded-xl text-[16px] font-bold uppercase hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer size={16} /> Imprimer
          </button>

          <div className="flex bg-gray-100/30 p-1 rounded-xl border border-gray-100/50">
            <button 
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-red-600'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-red-600'}`}
            >
              <Table size={16} />
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-red-600'}`}
            >
              <CalendarIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="w-10 h-10 text-gray-500 animate-spin mb-4" />
            <p className="text-[16px] font-bold text-red-800 uppercase tracking-widest">Chargement...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 border border-dashed border-gray-100 rounded-[2rem]">
            <CheckCircle2 size={48} className="text-gray-100 mb-4" />
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-widest">Tout est à jour</h3>
            <p className="text-[16px] font-medium text-gray-400 uppercase tracking-widest text-center px-4">Aucune échéance en attente pour ces critères.</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupedList.map((invoice) => (
              <div key={invoice.facture_id} className="bg-white/80 border border-gray-50/50 rounded-3xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group">
                <div className="p-5 bg-gray-50/20 border-b border-gray-50 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-900 text-xl leading-none mb-1">{invoice.number}</h4>
                    <p className="text-[15px] font-bold text-red-600/80 uppercase tracking-widest">{invoice.client_name}</p>
                    <p className="text-[14px] font-medium text-gray-400 uppercase mt-1">Global: {invoice.total_amount.toLocaleString()} Ar</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-bold text-gray-400 uppercase leading-none mb-1 tracking-wider">Restant</p>
                    <p className="text-xl font-bold text-red-600">{invoice.total_remaining.toLocaleString()} Ar</p>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {invoice.installments.map((inst, idx) => {
                    const isOverdue = new Date(inst.date_echeance) < new Date();
                    return (
                      <div key={inst.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-50/30 bg-white/50 group/item hover:bg-gray-50/30 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base ${isOverdue ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-50 text-red-600'}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className={`text-[17px] font-bold ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
                              {new Date(inst.date_echeance).toLocaleDateString()}
                            </p>
                            <p className="text-[15px] font-medium text-gray-400 uppercase">{inst.montant.toLocaleString()} Ar</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => setSelectedInvoiceHistory(invoice.full_facture)}
                            className="bg-white text-red-600 border border-gray-100 p-2 rounded-lg shadow-sm hover:bg-gray-50 transition-all"
                            title="Détails"
                          >
                            <List size={14} />
                          </button>
                          <button 
                            onClick={() => setPaymentModal({ echeance: inst })}
                            className="bg-red-600 text-white px-3 py-1.5 rounded-lg shadow shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-1.5 text-[15px] font-bold uppercase tracking-wider"
                          >
                            <Banknote size={12} /> Payer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white/70 backdrop-blur-md border border-gray-50/50 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b border-gray-50/50">
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest">Facture</th>
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest">Client</th>
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest">Échéance</th>
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-right">Global</th>
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-right">Avances</th>
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-right">Dû</th>
                  <th className="p-4 text-[15px] font-bold text-red-600 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50/30">
                {filtered.map(d => {
                  const isOverdue = new Date(d.date_echeance) < new Date();
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/10 transition-colors">
                      <td className="p-4 font-bold text-gray-700 text-base uppercase">{d.factures?.number}</td>
                      <td className="p-4 text-[16px] font-medium text-gray-400 uppercase tracking-tight">{d.factures?.clients?.name || d.factures?.guest_name}</td>
                      <td className="p-4">
                        <span className={`text-[16px] font-bold uppercase px-2 py-1 rounded-md ${isOverdue ? 'bg-red-50 text-red-500 border border-red-100/50' : 'bg-gray-50 text-red-600 border border-gray-100/50'}`}>
                          {new Date(d.date_echeance).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-gray-400 text-right text-[17px]">{d.factures?.total_amount?.toLocaleString()} Ar</td>
                      <td className="p-4 font-bold text-red-600 text-right text-[17px]">{d.totalPaid.toLocaleString()} Ar</td>
                      <td className="p-4 font-bold text-gray-800 text-right text-[17px]">{d.montant.toLocaleString()} Ar</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                            <button 
                                onClick={() => setSelectedInvoiceHistory(d.factures)}
                                className="bg-white text-red-600 border border-gray-100/50 p-1.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all"
                                title="Détails"
                            >
                                <List size={14} />
                            </button>
                            <button 
                                onClick={() => setPaymentModal({ echeance: d })}
                                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[15px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-1.5 shadow shadow-red-200"
                            >
                                <Banknote size={12} /> Payer
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white/70 backdrop-blur-md border border-gray-50/50 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-widest flex items-center gap-3">
                <CalendarIcon className="text-gray-500" size={20} /> {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-2.5 bg-gray-50 text-red-600 rounded-xl hover:bg-gray-100 transition-all"><ChevronLeft size={18} /></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-2.5 bg-gray-50 text-red-600 rounded-xl hover:bg-gray-100 transition-all"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-3">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
                <div key={day} className="text-center text-[15px] font-bold text-gray-400 uppercase tracking-widest mb-4">{day}</div>
              ))}
              {[...Array(firstDay)].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(days)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayDeadlines = filtered.filter(d => d.date_echeance === dateStr);
                return (
                  <div key={day} className={`aspect-square border rounded-2xl p-2 flex flex-col items-center justify-between transition-all ${dayDeadlines.length > 0 ? 'border-emerald-200 bg-gray-50/30 shadow-sm shadow-red-200/20' : 'border-gray-50'}`}>
                    <span className="text-[16px] font-bold text-gray-300">{day}</span>
                    {dayDeadlines.length > 0 && (
                      <div className="flex flex-col gap-1 w-full mt-1">
                        {dayDeadlines.map(d => (
                          <div key={d.id} onClick={() => setPaymentModal({ echeance: d })} className="bg-red-600 text-white text-[13px] font-bold p-1 rounded-md truncate cursor-pointer hover:bg-red-700 shadow-sm transition-colors">
                            {d.factures?.number}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[320px] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-base font-bold text-gray-800 uppercase tracking-widest">Encaisser</h3>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/50">
                <p className="text-[14px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reste à payer</p>
                <p className="text-3xl font-bold text-red-600">{paymentModal.echeance.montant.toLocaleString()} Ar</p>
                <p className="text-[15px] font-medium text-gray-500 uppercase mt-1">{paymentModal.echeance.factures?.number}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[14px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Montant</label>
                  <input 
                    type="number" 
                    className="w-full bg-gray-50/50 border border-gray-100 rounded-lg px-3 py-2 text-base outline-none focus:border-gray-500 transition-all font-bold text-gray-900"
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Méthode</label>
                    <div className={`grid grid-cols-4 gap-1 p-1 rounded-lg transition-all ${!paymentInfo.method ? 'bg-red-50 border border-red-100' : 'bg-gray-50/50 border border-gray-100'}`}>
                      {['esp', 'mm', 'vir', 'cheq'].map(m => (
                        <button 
                          key={m}
                          onClick={() => setPaymentInfo({...paymentInfo, method: m})}
                          className={`py-1.5 rounded-md text-[13px] font-bold uppercase tracking-widest border transition-all ${paymentInfo.method === m ? 'bg-red-600 border-red-600 text-white shadow-sm' : 'bg-white/80 border-gray-100 text-gray-400 hover:text-red-600'}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Référence</label>
                    <input 
                      type="text" 
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-lg px-3 py-2 text-base outline-none focus:border-gray-500 transition-all font-medium text-gray-600"
                      value={paymentInfo.reference}
                      onChange={e => setPaymentInfo({...paymentInfo, reference: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleMarkAsPaid}
                disabled={isProcessing}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200/50 active:scale-95 transition-all flex items-center justify-center gap-2 text-[16px] uppercase tracking-widest disabled:bg-gray-200 mt-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <><CheckCircle2 size={14} /> Confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Historique des Avances */}
      {selectedInvoiceHistory && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-50">
            <div className="p-6 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-gray-900 uppercase tracking-widest">Détails des Avances</h3>
                <p className="text-[15px] font-medium text-red-600/80 uppercase mt-1">{selectedInvoiceHistory.number}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoiceHistory(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-gray-400 hover:text-red-500 shadow-sm transition-all hover:rotate-90 no-print"
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
                  <p className="text-base font-bold text-gray-900">{Number(selectedInvoiceHistory.total_amount).toLocaleString()} Ar</p>
                </div>
                <div className="bg-red-600 p-3 rounded-2xl shadow-md shadow-red-200/50">
                  <p className="text-[13px] font-bold text-gray-100 uppercase mb-1">Payé</p>
                  <p className="text-base font-bold text-white">
                    {selectedInvoiceHistory.paiements?.reduce((sum, p) => sum + Number(p.montant), 0).toLocaleString()} Ar
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {selectedInvoiceHistory.paiements?.length > 0 ? (
                  selectedInvoiceHistory.paiements.map((p, idx) => (
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
                  <div className="text-center py-8">
                    <AlertCircle className="mx-auto text-gray-200 mb-2" size={24} />
                    <p className="text-[15px] font-bold text-gray-400 uppercase tracking-widest">Aucun versement</p>
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => setSelectedInvoiceHistory(null)}
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

