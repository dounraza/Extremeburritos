import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Search, 
  Printer, 
  Filter, 
  ChevronDown, 
  Package, 
  User, 
  Calendar,
  Truck,
  FileText,
  Loader2,
  Plus,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export default function StockEntry() {
  const [activeTab, setActiveTab] = useState('with-supplier');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [withSupplierData, setWithSupplierData] = useState([]);
  const [withoutSupplierData, setWithoutSupplierData] = useState([]);

  // BL Creation States
  const [showBLModal, setShowBLModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [depots, setDepots] = useState([]);
  
  const [blFormData, setBLFormData] = useState({
    supplier_id: '',
    bl_number: `BL-${Date.now().toString().slice(-6)}`,
    bl_date: new Date().toISOString().split('T')[0],
    payment_type: 'direct_sale',
    credit_type: '',
    first_due_date: '',
    total_amount: 0,
    depot_id: ''
  });

  const [blItems, setBLItems] = useState([]);
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: '',
    purchase_price_per_unit: '',
    unit: 'base'
  });

  // Quick Product Creation States
  const [showProductModal, setShowProductModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [unites, setUnites] = useState([]);
  const [productFormData, setProductFormData] = useState({
    name: '', price: '', price_superior: '', purchase_price: '', category_id: '', fournisseur_id: '', description: '',
    unite_base: 'unité', unite_superieure: '', quantite_par_unite: 1,
    unite_standard_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    fetchSuppliersAndProducts();
  }, []);

  useEffect(() => {
    if (showBLModal) {
      console.log("StockEntry: BL Modal opened, current products count:", products.length);
      if (products.length === 0) {
        fetchSuppliersAndProducts();
      }
    }
  }, [showBLModal]);

  const formatStock = (quantity, p) => {
    const q = Number(quantity) || 0;
    const qpu = Number(p.quantite_par_unite) || 1;
    const uSup = p.unite_superieure || 'Colis';
    const uBase = p.unite_base || 'Unités';

    if (qpu > 1) {
      const superior = Math.floor(q / qpu);
      const base = q % qpu;
      if (superior === 0) return `${base} ${uBase}`;
      if (base === 0) return `${superior} ${uSup}`;
      return `${superior} ${uSup} + ${base} ${uBase}`;
    }
    return `${q} ${uBase}`;
  };

  const fetchSuppliersAndProducts = async () => {
    try {
      setIsSubmitting(true);
      console.log("StockEntry: Fetching suppliers, products, depots, categories and units...");
      const [sRes, pRes, dRes, cRes, uRes] = await Promise.all([
        supabase.from('fournisseurs').select('*').order('name'),
        supabase.from('produits').select('*').order('name'),
        supabase.from('depots').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('unites_standards').select('*').order('nom')
      ]);

      if (sRes.error) throw sRes.error;
      if (pRes.error) throw pRes.error;
      if (dRes.error) throw dRes.error;
      if (cRes.error) throw cRes.error;
      if (uRes.error) throw uRes.error;

      if (sRes.data) setSuppliers(sRes.data);
      if (pRes.data) {
        console.log("StockEntry: Products loaded:", pRes.data.length);
        setProducts(pRes.data);
      }
      if (cRes.data) setCategories(cRes.data);
      if (uRes.data) setUnites(uRes.data);
      
      if (dRes.data) {
        setDepots(dRes.data);
        const principal = dRes.data.find(dep => dep.name.toLowerCase().includes('principal')) || dRes.data[0];
        if (principal && !blFormData.depot_id) {
          setBLFormData(prev => ({ ...prev, depot_id: principal.id }));
        }
      }
    } catch (err) {
      console.error("StockEntry: Error in fetchSuppliersAndProducts:", err);
      alert("Erreur lors du chargement des données : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'with-supplier') {
        const { data, error } = await supabase
          .from('delivery_note_items')
          .select(`
            id,
            quantity,
            purchase_price_per_unit,
            line_total_purchase,
            unit,
            created_at,
            delivery_notes (
              bl_number,
              bl_date,
              payment_type,
              fournisseurs!delivery_notes_supplier_id_fkey (
                name
              )
            ),
            produits!delivery_note_items_product_id_fkey (
              name
            )
          `)
          .not('delivery_notes.supplier_id', 'is', null)
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log("StockEntry: Fetched with-supplier data:", data);
        setWithSupplierData(data || []);
      } else {
        // Fetch entries that have NO supplier (or movements without BL)
        const { data, error } = await supabase
          .from('delivery_note_items')
          .select(`
            id,
            quantity,
            purchase_price_per_unit,
            line_total_purchase,
            unit,
            created_at,
            delivery_notes (
              bl_number,
              bl_date,
              payment_type
            ),
            produits!delivery_note_items_product_id_fkey (
              name
            )
          `)
          .is('delivery_notes.supplier_id', null)
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log("StockEntry: Fetched without-supplier data:", data);
        setWithoutSupplierData(data || []);
      }

    } catch (err) {
      console.error("Error fetching stock entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const addItemToBL = () => {
    if (!newItem.product_id || !newItem.quantity || !newItem.purchase_price_per_unit) {
      alert("Veuillez remplir tous les champs de l'article");
      return;
    }

    const product = products.find(p => p.id === newItem.product_id);
    const qty = parseFloat(newItem.quantity);
    const price = parseFloat(newItem.purchase_price_per_unit);
    const itemTotal = qty * price;
    
    // Calculer la quantité réelle en unité de base pour le stock
    let baseQuantity = qty;
    if (newItem.unit === 'superior' && product.quantite_par_unite) {
      baseQuantity = qty * parseFloat(product.quantite_par_unite);
    }
    
    const unitName = newItem.unit === 'superior' ? (product.unite_superieure || 'Colis') : (product.unite_base || 'Unités');

    setBLItems([...blItems, { 
      ...newItem, 
      productName: product.name, 
      total: itemTotal,
      baseQuantity,
      unitName
    }]);
    
    setBLFormData(prev => ({ ...prev, total_amount: prev.total_amount + itemTotal }));
    
    setNewItem({
      product_id: '',
      quantity: '',
      purchase_price_per_unit: '',
      unit: 'base'
    });
  };

  const removeItemFromBL = (index) => {
    const item = blItems[index];
    setBLItems(blItems.filter((_, i) => i !== index));
    setBLFormData(prev => ({ ...prev, total_amount: prev.total_amount - item.total }));
  };

  const handleSaveBL = async (e) => {
    e.preventDefault();
    if (blItems.length === 0) {
      alert("Veuillez ajouter au moins un article.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create BL
      const { data: bl, error: blError } = await supabase
        .from('delivery_notes')
        .insert([{
          supplier_id: blFormData.supplier_id && blFormData.supplier_id.trim() !== '' ? blFormData.supplier_id : null,
          bl_number: blFormData.bl_number,
          bl_date: blFormData.bl_date,
          total_amount: blFormData.total_amount,
          total_initial: blFormData.total_amount,
          payment_type: blFormData.payment_type,
          due_date: (blFormData.payment_type === 'credit' && blFormData.first_due_date) ? blFormData.first_due_date : null,
          credit_type: blFormData.payment_type === 'credit' ? blFormData.credit_type : null,
          user_id: user.id
        }])
        .select()
        .single();

      if (blError) throw blError;

      // 2. Create items and update stock
      for (const item of blItems) {
        // Create delivery note item
        await supabase.from('delivery_note_items').insert([{
          delivery_note_id: bl.id,
          product_id: item.product_id,
          quantity: item.quantity,
          purchase_price_per_unit: item.purchase_price_per_unit,
          line_total_purchase: item.total,
          unit: item.unit === 'superior' ? 'superior' : 'base'
        }]);

        // Create stock movement (Always record in base units for calculation consistency)
        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          type: 'in',
          quantity: item.baseQuantity,
          price_at_movement: item.purchase_price_per_unit,
          reason: `BL #${blFormData.bl_number}`,
          delivery_note_id: bl.id,
          user_id: user.id,
          unit: 'base'
        }]);

        // Update physical stock in selected depot
        const { data: existingStock } = await supabase
          .from('stocks')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('depot_id', blFormData.depot_id)
          .maybeSingle();

        if (existingStock) {
          await supabase.from('stocks')
            .update({ quantity: parseFloat(existingStock.quantity) + parseFloat(item.baseQuantity) })
            .eq('id', existingStock.id);
        } else {
          await supabase.from('stocks').insert([{
            product_id: item.product_id,
            depot_id: blFormData.depot_id,
            quantity: item.baseQuantity
          }]);
        }
        
        // Update global product purchase price if needed
        await supabase.from('produits')
          .update({ purchase_price: item.purchase_price_per_unit })
          .eq('id', item.product_id);
      }

      alert("Bon de livraison enregistré avec succès !");
      setShowBLModal(false);
      setActiveTab('with-supplier');
      setBLItems([]);
      setBLFormData({
        supplier_id: '',
        bl_number: `BL-${Date.now().toString().slice(-6)}`,
        bl_date: new Date().toISOString().split('T')[0],
        payment_type: 'direct_sale',
        total_amount: 0,
        depot_id: depots[0]?.id || ''
      });
      fetchData();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUniteStandardChange = (unitId) => {
    const selectedUnit = unites.find(u => u.id === unitId);
    if (selectedUnit) {
      setProductFormData(prev => ({
        ...prev,
        unite_standard_id: unitId,
        unite_base: selectedUnit.unite_mesure,
        unite_superieure: selectedUnit.nom,
        quantite_par_unite: selectedUnit.facteur
      }));
    } else {
      setProductFormData(prev => ({ ...prev, unite_standard_id: '' }));
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: productFormData.name,
        price: parseFloat(productFormData.price) || 0,
        price_superior: parseFloat(productFormData.price_superior) || 0,
        purchase_price: parseFloat(productFormData.purchase_price) || 0,
        category_id: productFormData.category_id || null,
        fournisseur_id: productFormData.fournisseur_id || null,
        description: productFormData.description || '',
        quantite_par_unite: parseInt(productFormData.quantite_par_unite) || 1,
        unite_base: productFormData.unite_base || 'unité',
        unite_superieure: productFormData.unite_superieure || '',
        unite_standard_id: (productFormData.unite_standard_id && productFormData.unite_standard_id !== "") ? productFormData.unite_standard_id : null
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Vous devez être connecté.");
        setIsSubmitting(false);
        return;
      }

      const { data: newProduct, error } = await supabase.from('produits').insert([{ 
        ...payload, 
        user_id: user.id
      }]).select().single();

      if (error) throw error;

      await fetchSuppliersAndProducts();
      setNewItem(prev => ({ ...prev, product_id: newProduct.id, purchase_price_per_unit: '' }));
      setShowProductModal(false);
      setProductFormData({
        name: '', price: '', price_superior: '', purchase_price: '', category_id: '', fournisseur_id: '', description: '',
        unite_base: 'unité', unite_superieure: '', quantite_par_unite: 1,
        unite_standard_id: ''
      });
      
      alert("Produit créé et sélectionné !");
    } catch (err) {
      alert("Erreur lors de la création du produit : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header & Filters */}
      <div className="bg-white/60 backdrop-blur-md border border-gray-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-500 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200">
              <Package className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight">Entrées de Stock</h1>
              <p className="text-base text-red-600 font-bold uppercase tracking-widest mt-1">Gestion des approvisionnements</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
              <div className="flex items-center gap-2 px-3">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-[16px] font-black text-gray-400 uppercase">De</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-lg font-bold text-gray-700 outline-none" 
                />
              </div>
              <div className="w-px h-8 bg-gray-50"></div>
              <div className="flex items-center gap-2 px-3">
                <span className="text-[16px] font-black text-gray-400 uppercase">À</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-lg font-bold text-gray-700 outline-none" 
                />
              </div>
            </div>
            
            <button 
              onClick={() => setShowBLModal(true)}
              className="px-6 py-3 bg-red-600 text-white font-black text-base uppercase tracking-widest rounded-2xl shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Nouveau BL
            </button>
            
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-600 font-black text-base uppercase tracking-widest rounded-2xl hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2"
            >
              <Search size={16} /> Valider
            </button>
            
            <button 
              onClick={handlePrint}
              className="px-6 py-3 bg-white border-2 border-red-600 text-red-600 font-black text-base uppercase tracking-widest rounded-2xl hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2"
            >
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>
      </div>

      {/* BL Modal */}
      {showBLModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/20 backdrop-blur-[2px] p-2 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-gray-50/50">
            <div className="p-6 md:p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                  <FileText className="text-white" size={20} />
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">Nouveau Bon de Livraison</h3>
                    <p className="text-[16px] font-medium text-red-600/80 uppercase tracking-widest mt-0.5">Enregistrement des entrées de marchandises</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowBLModal(false);
                  setBLFormData({
                    supplier_id: '',
                    bl_number: `BL-${Date.now().toString().slice(-6)}`,
                    bl_date: new Date().toISOString().split('T')[0],
                    payment_type: 'direct_sale',
                    total_amount: 0,
                    depot_id: depots[0]?.id || ''
                  });
                  setBLItems([]);
                }} 
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-gray-400 hover:text-red-500 shadow-sm transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
              <form onSubmit={handleSaveBL} className="space-y-8">
                {/* BL Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[15px] font-bold text-red-600 uppercase ml-1 tracking-widest">N° BL (Auto)</label>
                    <input 
                      type="text"
                      readOnly
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-900 outline-none cursor-not-allowed"
                      value={blFormData.bl_number}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Fournisseur</label>
                    <select 
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                      value={blFormData.supplier_id}
                      onChange={e => setBLFormData({...blFormData, supplier_id: e.target.value})}
                    >
                      <option value="">Pas de fournisseur</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Date du BL</label>
                    <input 
                      type="date"
                      required
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                      value={blFormData.bl_date}
                      onChange={e => setBLFormData({...blFormData, bl_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Dépôt Destination</label>
                    <select 
                      required
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                      value={blFormData.depot_id}
                      onChange={e => setBLFormData({...blFormData, depot_id: e.target.value})}
                    >
                      {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Type de Paiement</label>
                    <select 
                      required
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                      value={blFormData.payment_type}
                      onChange={e => setBLFormData({...blFormData, payment_type: e.target.value})}
                    >
                      <option value="direct_sale">Vente Directe</option>
                      <option value="credit">Vente à Crédit</option>
                    </select>
                  </div>
                  {blFormData.payment_type === 'credit' && (
                    <>
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Échéance</label>
                        <select 
                          required
                          className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                          value={blFormData.credit_type}
                          onChange={e => setBLFormData({...blFormData, credit_type: e.target.value})}
                        >
                          <option value="">Choisir...</option>
                          <option value="journalier">Journalier</option>
                          <option value="mensuel">Mensuel</option>
                        </select>
                      </div>
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                        <label className="text-[15px] font-bold text-gray-400 uppercase ml-1 tracking-widest">1ère échéance</label>
                        <input 
                          type="date"
                          required
                          className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                          value={blFormData.first_due_date}
                          onChange={e => setBLFormData({...blFormData, first_due_date: e.target.value})}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Add Items Form */}
                <div className="bg-gray-50/20 p-5 md:p-6 rounded-3xl border border-gray-50/50">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-base font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                      <Plus size={14} className="text-gray-500" /> Ajouter des articles
                    </h4>
                    {/* <button 
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="text-[14px] font-black text-red-600 uppercase tracking-widest bg-white px-4 py-1.5 rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-all"
                    >
                      + Nouveau Produit
                    </button> */}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[15px] font-bold text-red-600/70 uppercase ml-1 tracking-widest">Produit</label>
                      <select 
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                        value={newItem.product_id}
                        onChange={e => {
                          const p = products.find(prod => prod.id === e.target.value);
                          setNewItem({...newItem, product_id: e.target.value, purchase_price_per_unit: p?.purchase_price || ''});
                        }}
                      >
                        <option value="">Sélectionner un produit...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {formatStock(p.stock_quantity, p)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[15px] font-bold text-red-600/70 uppercase ml-1 tracking-widest">Quantité</label>
                      <input 
                        type="number"
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                        value={newItem.quantity}
                        placeholder="0"
                        onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[15px] font-bold text-red-600/70 uppercase ml-1 tracking-widest">Unité</label>
                      <select
                        className="w-full bg-white border border-gray-100 rounded-xl px-2 py-2.5 text-[16px] font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                      >
                        <option value="base">{products.find(p => p.id === newItem.product_id)?.unite_base || 'Unité'}</option>
                        {products.find(p => p.id === newItem.product_id)?.unite_superieure && (
                          <option value="superior">{products.find(p => p.id === newItem.product_id)?.unite_superieure}</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[15px] font-bold text-red-600/70 uppercase ml-1 tracking-widest">Prix Achat</label>
                      <input 
                        type="number"
                        className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-base font-bold text-gray-700 outline-none focus:border-gray-500 transition-all"
                        value={newItem.purchase_price_per_unit}
                        placeholder="0"
                        onChange={e => setNewItem({...newItem, purchase_price_per_unit: e.target.value})}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={addItemToBL}
                      className="bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-all text-[16px] uppercase tracking-widest shadow-lg shadow-red-200/50 active:scale-95"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {blItems.length > 0 && (
                  <div className="border border-gray-50 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-gray-50/30 border-b border-gray-50">
                          <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest">Produit</th>
                          <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest text-center">Quantité</th>
                          <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest text-right">P.A.U</th>
                          <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest text-right">Total</th>
                          <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 bg-white/50">
                        {blItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/10 transition-colors">
                            <td className="px-6 py-3 text-base font-bold text-gray-700 uppercase">{item.productName}</td>
                            <td className="px-6 py-3 text-base font-bold text-red-600 text-center">{item.quantity} {item.unitName}</td>
                            <td className="px-6 py-3 text-base font-bold text-gray-500 text-right">{parseFloat(item.purchase_price_per_unit).toLocaleString()} Ar</td>
                            <td className="px-6 py-3 text-base font-bold text-gray-800 text-right">{item.total.toLocaleString()} Ar</td>
                            <td className="px-6 py-3 text-center">
                              <button onClick={() => removeItemFromBL(idx)} className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50/20">
                          <td colSpan="3" className="px-6 py-4 text-[16px] font-bold text-red-800 uppercase tracking-widest text-right">Total Général</td>
                          <td className="px-6 py-4 text-xl font-bold text-gray-900 text-right">{blFormData.total_amount.toLocaleString()} Ar</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-6 border-t border-gray-50/50 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setShowBLModal(false)}
                    className="px-6 py-3 rounded-xl text-[16px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || blItems.length === 0}
                    className="px-8 py-3 bg-red-600 text-white font-bold text-[16px] uppercase tracking-widest rounded-xl shadow-lg shadow-red-200/50 hover:bg-red-700 disabled:bg-gray-200 active:scale-95 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Enregistrer le BL</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-50/30 p-1 rounded-2xl border border-gray-100/50 max-w-sm">
        <button 
          onClick={() => setActiveTab('with-supplier')}
          className={`flex-1 py-2 rounded-xl text-[16px] font-bold uppercase tracking-wider transition-all ${activeTab === 'with-supplier' ? 'bg-white text-red-600 shadow-sm border border-gray-50/50' : 'text-red-400 hover:text-red-600'}`}
        >
          Avec Fournisseur
        </button>
        <button 
          onClick={() => setActiveTab('without-supplier')}
          className={`flex-1 py-2 rounded-xl text-[16px] font-bold uppercase tracking-wider transition-all ${activeTab === 'without-supplier' ? 'bg-white text-red-600 shadow-sm border border-gray-50/50' : 'text-red-400 hover:text-red-600'}`}
        >
          Sans Fournisseur
        </button>
      </div>

      {/* Table Area */}
      <div className="bg-white/70 backdrop-blur-md border border-gray-50/50 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-350px)]">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-gray-500" size={32} />
            <p className="text-[16px] font-bold text-red-600 uppercase tracking-widest">Chargement...</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            {activeTab === 'with-supplier' ? (
              <table className="w-full text-left border-collapse min-w-[1000px] sticky-header">
                <thead className="sticky top-0 z-20 bg-gray-50/50 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Date</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Fournisseur</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">N° BL</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Désignation</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Paiement</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50 text-center">Qté</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Unité</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50 text-right">P.A.U</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50 text-right">P.A.T</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/30">
                  {withSupplierData.filter(item => item.delivery_notes?.bl_number).length > 0 ? withSupplierData.filter(item => item.delivery_notes?.bl_number).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/10 transition-colors group">
                      <td className="px-6 py-3.5">
                        <p className="text-base font-bold text-gray-600">{new Date(item.delivery_notes?.bl_date || item.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-[17px] font-bold text-red-600 uppercase">{item.delivery_notes?.fournisseurs?.name || 'Inconnu'}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 bg-gray-50 text-red-600 border border-gray-100/50 rounded-md text-[15px] font-bold uppercase">
                          {item.delivery_notes?.bl_number || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-base font-bold text-gray-700">{item.produits?.name}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-md text-[15px] font-bold uppercase ${item.delivery_notes?.payment_type === 'credit' ? 'bg-orange-50 text-orange-600 border border-orange-100/50' : 'bg-blue-50 text-blue-600 border border-blue-100/50'}`}>
                          {item.delivery_notes?.payment_type === 'credit' ? 'Crédit' : 'Direct'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <p className="text-base font-bold text-red-600">{item.quantity}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-[16px] font-medium text-gray-400 uppercase tracking-wider">{item.unit === 'base' ? 'Unité' : (item.unit || 'Unité')}</p>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <p className="text-base font-bold text-gray-600">{parseFloat(item.purchase_price_per_unit).toLocaleString()} Ar</p>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <p className="text-base font-bold text-red-600">{parseFloat(item.line_total_purchase).toLocaleString()} Ar</p>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="9" className="p-20 text-center text-gray-400 font-bold uppercase text-[15px] tracking-widest">Aucune donnée trouvée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="sticky top-0 z-20 bg-gray-50/50 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Date</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Motif</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Désignation</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50 text-center">Qté</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50">Unité</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50 text-right">P.A.U</th>
                    <th className="px-6 py-4 text-[15px] font-bold text-red-800 uppercase tracking-widest border-b border-gray-100/50 text-right">P.A.T</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/30">
                  {withoutSupplierData.length > 0 ? withoutSupplierData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/10 transition-colors group">
                      <td className="px-6 py-3.5">
                        <p className="text-base font-bold text-gray-600">{new Date(item.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-[16px] font-bold text-red-600 uppercase tracking-widest">{item.reason || '-'}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-base font-bold text-gray-700">{item.produits?.name}</p>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <p className="text-base font-bold text-red-600">{item.quantity}</p>
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="text-[16px] font-medium text-gray-400 uppercase tracking-wider">{item.unit || 'Unité'}</p>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <p className="text-base font-bold text-gray-600">{(item.price_at_movement || 0).toLocaleString()} Ar</p>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <p className="text-base font-bold text-red-600">{(item.quantity * (item.price_at_movement || 0)).toLocaleString()} Ar</p>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" className="p-20 text-center text-gray-400 font-bold uppercase text-[15px] tracking-widest">Aucune donnée trouvée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Product Quick Creation Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/20">
              <h3 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">
                Nouveau Produit
              </h3>
              <button 
                onClick={() => setShowProductModal(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-gray-400 hover:text-red-500 shadow-sm transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[14px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Désignation</label>
                <input required placeholder="Nom du produit" className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500/20 font-bold" value={productFormData.name} onChange={e => setProductFormData({...productFormData, name: e.target.value})} />
              </div>
              
              <div className="space-y-3">
                <h4 className="text-[14px] font-black text-red-600 uppercase tracking-widest border-b border-gray-50 pb-1">Configuration & Stock</h4>
                <div className="space-y-1">
                    <label className="text-[14px] font-bold text-red-600 uppercase ml-1">Unité Standard</label>
                    <select 
                    className="w-full bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 outline-none text-base font-black text-red-600" 
                    value={productFormData.unite_standard_id || ''} 
                    onChange={e => handleUniteStandardChange(e.target.value)}
                    >
                    <option value="">Sélectionner conversion...</option>
                    {unites.map(u => <option key={u.id} value={u.id}>{u.nom} ({u.facteur} {u.unite_mesure})</option>)}
                    </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[14px] font-bold text-red-600 uppercase ml-1">Prix d'Achat (MGA)</label>
                  <input type="number" placeholder="Prix d'achat" className="w-full bg-gray-50/30 border border-gray-100 rounded-xl px-4 py-3 outline-none font-black text-red-600" value={productFormData.purchase_price} onChange={e => setProductFormData({...productFormData, purchase_price: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-gray-400 uppercase ml-1">
                      Prix de vente (MGA) / {productFormData.unite_base || 'unité'}
                    </label>
                    <input required type="number" placeholder="Prix Unité" className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none font-bold" value={productFormData.price} onChange={e => setProductFormData({...productFormData, price: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">
                      Prix de vente (MGA)/ {productFormData.unite_superieure || 'sup.'}
                    </label>
                    <input type="number" placeholder="Prix Supérieur" className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none font-bold text-red-600" value={productFormData.price_superior} onChange={e => setProductFormData({...productFormData, price_superior: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-gray-400 uppercase ml-1">Catégorie</label>
                    <select className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none text-base font-bold text-gray-600" value={productFormData.category_id} onChange={e => setProductFormData({...productFormData, category_id: e.target.value})}>
                      <option value="">Sélectionner...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[14px] font-bold text-gray-400 uppercase ml-1">Fournisseur</label>
                    <select className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none text-base font-bold text-gray-600" value={productFormData.fournisseur_id} onChange={e => setProductFormData({...productFormData, fournisseur_id: e.target.value})}>
                      <option value="">Sélectionner...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Units & Conversion - Improved style like ProductList */}
              <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 space-y-4">
                  <h4 className="text-orange-700 font-black uppercase text-sm tracking-widest flex items-center gap-2">
                      <Package size={16} /> Configuration des Unités (Colisage)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                          <label className="text-[12px] font-black text-orange-600/70 uppercase ml-1">Qté par unité supérieure ({productFormData.unite_superieure || 'CARTON'})</label>
                          <input 
                              type="number" required min="1"
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-black text-xl text-orange-700 outline-none"
                              value={productFormData.quantite_par_unite}
                              onChange={e => setProductFormData({...productFormData, quantite_par_unite: e.target.value})}
                          />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[12px] font-black text-orange-600/70 uppercase ml-1">Nom Unité Sup.</label>
                          <input 
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-bold uppercase outline-none"
                              value={productFormData.unite_superieure}
                              onChange={e => setProductFormData({...productFormData, unite_superieure: e.target.value.toUpperCase()})}
                          />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[12px] font-black text-orange-600/70 uppercase ml-1">Nom Unité Base</label>
                          <input 
                              className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 font-bold uppercase outline-none"
                              value={productFormData.unite_base}
                              onChange={e => setProductFormData({...productFormData, unite_base: e.target.value.toUpperCase()})}
                          />
                      </div>
                  </div>
                  <p className="text-orange-600/60 text-[11px] font-bold italic px-1">
                      * 1 {productFormData.unite_superieure || 'CARTON'} contient {productFormData.quantite_par_unite} {productFormData.unite_base || 'PCE'}
                  </p>
              </div>
              
              <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-black py-4 rounded-xl shadow-lg shadow-red-200 mt-2 active:scale-[0.98] transition-all uppercase tracking-widest text-base">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bg-white\/60 { background: white !important; border: none !important; }
          .bg-gray-50\/50 { background: white !important; }
          table, th, td { border: 1px solid #e2e8f0 !important; }
          .overflow-hidden { overflow: visible !important; }
          .overflow-x-auto { overflow: visible !important; }
          .min-w-\[1000px\], .min-w-\[800px\] { min-width: 100% !important; }
          .bg-red-600 { color: black !important; background: none !important; }
          .text-red-600, .text-red-600, .text-red-800 { color: black !important; }
          
          /* Show only the table area when printing */
          .overflow-x-auto, .overflow-x-auto * { visibility: visible; }
          .overflow-x-auto { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

