import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  LogOut, 
  Package, 
  Users, 
  FileText, 
  LayoutDashboard, 
  Search, 
  Bell, 
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Truck,
  Tag,
  Menu,
  X,
  ChevronDown,
  ShoppingCart,
  Calendar,
  Clock,
  Settings as SettingsIcon,
  Box,
  Shield,
  DollarSign,
  Building2,
  ArrowRightLeft,
  Utensils,
  CreditCard
} from 'lucide-react';
import Inventory from '../components/Inventory';
import ProductList from '../components/ProductList';
import StockEntry from '../components/StockEntry';
import Clients from '../components/Clients';
import Suppliers from '../components/Suppliers';
import SupplierCreditHistory from '../components/SupplierCreditHistory';
import Categories from '../components/Categories';
import Billing from '../components/Billing';
import POSSimple from '../components/POSSimple';
import POS from '../components/POS';
import Deadlines from '../components/Deadlines';
import CreditHistory from '../components/CreditHistory';
import SupplierCredits from '../components/SupplierCredits';
import Settings from '../components/Settings';
import Depots from '../components/Depots';
import StockTransfer from '../components/StockTransfer';
import Conversions from '../components/Conversions';
import SalesDashboard from '../components/SalesDashboard';
import StockHistory from '../components/StockHistory';
import Decaissement from '../components/Decaissement';
import OrderTaker from '../components/OrderTaker';
import KitchenMonitor from '../components/KitchenMonitor';
import RestaurantPOS from '../components/RestaurantPOS';
import MenuManager from '../components/MenuManager';
import UserManagement from '../components/UserManagement';

export default function Dashboard({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const activeTab = useMemo(() => {
    const path = location.pathname.split('/').pop();
    if (path === 'dashboard' || !path) return 'dashboard';
    return path;
  }, [location.pathname]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const [depots, setDepots] = useState([]);
  const [selectedDepotId, setSelectedDepotId] = useState(localStorage.getItem('selectedDepotId') || '');
  const [stats, setStats] = useState({
    totalSales: 0,
    stockAlerts: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueCredits: 0
  });
  const [loading, setLoading] = useState(true);
  const [billingSearchTerm, setBillingSearchTerm] = useState('');
  const [deadlineSearchTerm, setDeadlineSearchTerm] = useState('');
  const [overdueList, setOverdueList] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminAuthCode, setAdminAuthCode] = useState('');
  const [dbAdminCode, setDbAdminCode] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!session?.user?.id) return;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (data) {
        setUserRole(data.role);
      } else {
        // Default role if not found
        setUserRole('serveur'); 
      }
    };
    fetchUserRole();
  }, [session]);

  useEffect(() => {
    const fetchAdminCode = async () => {
        const { data } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'admin_code')
            .single();
        if (data) setDbAdminCode(data.value);
    };
    fetchAdminCode();
  }, []);

  const handleProtectedNavigation = (path) => {
    if (isAdminAuthenticated) {
      navigate(path);
      closeSidebar();
    } else {
      setPendingNavigation(path);
      setIsAdminAuthOpen(true);
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const handleViewClientCredit = (clientName) => {
    setDeadlineSearchTerm(clientName);
    navigate('/dashboard/deadlines');
  };

  const fetchDepots = async () => {
    const { data } = await supabase.from('depots').select('*').order('name');
    if (data) {
      setDepots(data);
      if (!selectedDepotId) {
        const principalDepot = data.find(d => d.name.toLowerCase().includes('principal'));
        const defaultId = principalDepot ? principalDepot.id : (data.length > 0 ? data[0].id : '');
        if (defaultId) {
          setSelectedDepotId(defaultId);
          localStorage.setItem('selectedDepotId', defaultId);
        }
      }
    }
  };

  const handleDepotChange = (e) => {
    const newId = e.target.value;
    setSelectedDepotId(newId);
    localStorage.setItem('selectedDepotId', newId);
  };

  const fetchStats = async () => {
    setLoading(true);
    // 1. Get total sales (paid invoices)
    const { data: invoices } = await supabase
      .from('factures')
      .select('total_amount, status');
    
    // Total Credits Clients (Solde restant)
    console.log("Invoices retrieved:", invoices);
    const clientCredits = invoices?.filter(inv => {
        const isCredit = ['sent', 'unpaid', 'pending', 'CRÉDIT', 'credit', 'Credit'].includes(inv.status) || inv.type === 'CRÉDIT';
        console.log("Invoice status check:", inv.status, inv.type, isCredit);
        return isCredit;
    }) || [];
    const totalClientCredits = clientCredits.reduce((acc, inv) => acc + (parseFloat(inv.total_amount) || 0), 0);
    console.log("Total Client Credits:", totalClientCredits);

    const paidInvoices = invoices?.filter(inv => inv.status === 'paid' || inv.status === 'COMPTANT') || [];
    const totalSales = paidInvoices.reduce((acc, inv) => acc + (parseFloat(inv.total_amount) || 0), 0) || 0;

    // 2. Get total supplier credits (remaining balance)
    const { data: supplierNotes } = await supabase
      .from('delivery_notes')
      .select('total_amount')
      .neq('payment_type', 'paid');
    
    const totalSupplierCredits = supplierNotes?.reduce((acc, note) => acc + (parseFloat(note.total_amount) || 0), 0) || 0;

    // 3. Get stock alerts
    const { count: stockAlerts } = await supabase
      .from('produits')
      .select('*', { count: 'exact', head: true })
      .lt('stock_quantity', 10);

    // 4. Get overdue credits
    const today = new Date().toISOString().split('T')[0];
    const { data: overdues } = await supabase
      .from('echeances_details')
      .select('*, factures(number, guest_name, clients(name))')
      .eq('statut', 'non_paye')
      .lt('date_echeance', today);

    setOverdueList(overdues || []);

    setStats({
      totalSales,
      totalClientCredits,
      totalSupplierCredits,
      stockAlerts: stockAlerts || 0,
      paidInvoices: paidInvoices.length,
      pendingInvoices: clientCredits.length,
      overdueCredits: overdues?.length || 0
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    fetchDepots();
  }, []);

  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isSuppliersOpen, setIsSuppliersOpen] = useState(false);
  const [isClientsOpen, setIsClientsOpen] = useState(false);

  const getTitle = () => {
    switch(activeTab) {
      case 'dashboard': return "Vue d'ensemble";
      case 'pos': return "Caisse / Vente Directe";
      case 'restaurant-order': return "Prise de Commande (Serveur)";
      case 'restaurant-kitchen': return "Cuisine (Moniteur)";
      case 'restaurant-pos': return "Caisse Restaurant (Encaissement)";
      case 'inventory': return "Stock & Denrées (Appro)";
      case 'stock-entry': return "Entrée de Stock";
      case 'clients': return "Liste des Clients";
      case 'credit_history': return "Historique Crédits Clients";
      case 'deadlines': return "Échéancier des Paiements";
      case 'suppliers': return "Liste Fournisseurs";
      case 'supplier-history': return "Historique Fournisseurs";
      case 'supplier_credits': return "Crédit Fournisseurs";
      case 'categories': return "Catégories";
      case 'billing': return "Facturation";
      case 'deadlines': return "Échéancier";
      case 'credit_history': return "Historique Crédits";
      case 'settings': return "Paramètres & Utilisateurs";
      case 'historique': return "Historique des Actions";
      default: return "Dashboard";
    }
  };

  const isPosMode = useMemo(() => 
    ['pos', 'pos-simple', 'restaurant-order', 'restaurant-kitchen', 'restaurant-pos'].includes(activeTab),
    [activeTab]
  );

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="relative min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Background Image (Idem Login) */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.05] bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000&auto=format&fit=crop')" }}
      ></div>

      {/* Mobile Overlay */}
      {(isSidebarOpen || (isPosMode && isSidebarOpen)) && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20"
          onClick={closeSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed ${isPosMode ? '' : 'lg:static'} inset-y-0 left-0 z-30 w-96 bg-black border-r border-gray-800 flex flex-col transform transition-transform duration-300 ease-in-out h-full overflow-y-auto ${isSidebarOpen ? 'translate-x-0' : (isPosMode ? '-translate-x-full' : '-translate-x-full lg:translate-x-0')}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div onClick={() => navigate('/dashboard')} className="cursor-pointer flex items-center gap-3">
              <img src="/logo.jpeg" alt="Logo" className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-red-900/20" />
              <h1 className="text-3xl font-bold text-white tracking-tight">Extrême<span className="text-red-600">Buritos</span></h1>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-red-600" onClick={closeSidebar}>
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 space-y-8 overflow-y-auto px-4 no-scrollbar pb-10">
            {/* GROUPE 1: Caisse & Ventes (superAdmin or Caissier) */}
            {(userRole === 'superAdmin' || userRole?.startsWith('Caissier')) && (
              <div>
                <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Caisse & Ventes</p>
                <div className="space-y-1">
                  <NavItem icon={<ShoppingCart size={20} />} label="Caisse Resto" active={activeTab === 'restaurant-pos'} onClick={() => { navigate('/dashboard/restaurant-pos'); closeSidebar(); }} />
                  <NavItem icon={<TrendingUp size={20} />} label="Résultat Journalière" active={activeTab === 'sales-analytics'} onClick={() => { navigate('/dashboard/sales-analytics'); closeSidebar(); }} />
                </div>
              </div>
            )}

            {/* RESTAURANT SECTION (superAdmin, serveur, cuisine, Caissier) */}
            <div>
              <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Restaurant Extrême Buritos</p>
              <div className="space-y-1">
                {(userRole === 'superAdmin') && (
                  <NavItem icon={<LayoutDashboard size={20} />} label="Gestion Menus" active={activeTab === 'menus'} onClick={() => { navigate('/dashboard/menus'); closeSidebar(); }} />
                )}
                {(userRole === 'superAdmin' || userRole === 'serveur') && (
                  <NavItem icon={<Utensils size={20} />} label="Prise de Commande" active={activeTab === 'restaurant-order'} onClick={() => { navigate('/dashboard/restaurant-order'); closeSidebar(); }} />
                )}
                {(userRole === 'superAdmin' || userRole === 'cuisine') && (
                  <NavItem icon={<Clock size={20} />} label="Cuisine" active={activeTab === 'restaurant-kitchen'} onClick={() => { navigate('/dashboard/restaurant-kitchen'); closeSidebar(); }} />
                )}
              </div>
            </div>

            {/* GROUPE 2: Gestion Financière (superAdmin only) */}
            {userRole === 'superAdmin' && (
              <>
                <div>
                  <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Gestion Financière</p>
                  <div className="space-y-1">
                    <NavItem icon={<FileText size={20} />} label="Facturation" active={activeTab === 'billing'} onClick={() => { navigate('/dashboard/billing'); closeSidebar(); }} />
                    <NavItem icon={<DollarSign size={20} />} label="Décaissements" active={activeTab === 'decaissement'} onClick={() => { navigate('/dashboard/decaissement'); closeSidebar(); }} />
                  </div>
                </div>

                {/* GROUPE 3: Clients */}
                <div>
                  <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Clients</p>
                  <div className="space-y-1">
                    <button 
                      onClick={() => setIsClientsOpen(!isClientsOpen)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all w-full text-left ${
                        ['clients', 'credit_history', 'deadlines'].includes(activeTab)
                          ? 'bg-red-600 text-white shadow-lg' 
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Users size={20} />
                        <span className="font-bold text-lg tracking-tight">Menu Client</span>
                      </div>
                      <ChevronDown size={16} className={`transition-transform ${isClientsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isClientsOpen && (
                      <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-700 pl-4">
                        <button 
                          onClick={() => { navigate('/dashboard/clients'); closeSidebar(); }}
                          className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'clients' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                          Liste
                        </button>
                        <button
                         onClick={() => { navigate('/dashboard/credit_history'); closeSidebar(); }}
                         className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'credit_history' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                         Historique client
                        </button>
                        <button
                         onClick={() => { navigate('/dashboard/deadlines'); closeSidebar(); }}
                         className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'deadlines' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                         Echéancier
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* GROUPE 4: Fournisseurs */}
                <div>
                  <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Fournisseurs</p>
                  <div className="space-y-1">
                    <button 
                      onClick={() => setIsSuppliersOpen(!isSuppliersOpen)}
                      className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all w-full text-left ${
                        ['suppliers', 'supplier-history', 'supplier_credits'].includes(activeTab)
                          ? 'bg-red-600 text-white shadow-lg' 
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Users size={20} />
                        <span className="font-bold text-lg tracking-tight">Menu Fournisseur</span>
                      </div>
                      <ChevronDown size={16} className={`transition-transform ${isSuppliersOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isSuppliersOpen && (
                      <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-700 pl-4">
                        <button 
                          onClick={() => { navigate('/dashboard/suppliers'); closeSidebar(); }}
                          className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'suppliers' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                          Liste Fournisseurs
                        </button>
                        <button 
                          onClick={() => { navigate('/dashboard/supplier_credits'); closeSidebar(); }}
                          className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'supplier_credits' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                        >
                          Crédit Fournisseurs
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* GROUPE 4: Stock & Logistique */}
                <div>
                  <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Stock & Logistique</p>
                  <div className="space-y-1">
                    <div className="space-y-1">
                      <button 
                        onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                        className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all w-full text-left ${
                          ['inventory', 'products', 'stock-entry', 'historique'].includes(activeTab)
                            ? 'bg-red-600 text-white shadow-lg' 
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Package size={20} />
                          <span className="font-bold text-lg tracking-tight">Gestion Stock</span>
                        </div>
                        <ChevronDown size={16} className={`transition-transform ${isInventoryOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isInventoryOpen && (
                        <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-700 pl-4">
                          <button 
                            onClick={() => handleProtectedNavigation('/dashboard/products')}
                            className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'products' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                          >
                            Stock Principal
                          </button>
                          <button 
                            onClick={() => handleProtectedNavigation('/dashboard/inventory')}
                            className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'inventory' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                          >
                            Stock par Dépôt
                          </button>
                          <button 
                            onClick={() => handleProtectedNavigation('/dashboard/stock-entry')}
                            className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'stock-entry' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                          >
                            Entrée de Stock
                          </button>
                          <button 
                            onClick={() => handleProtectedNavigation('/dashboard/historique')}
                            className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'historique' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                          >
                            Historique
                          </button>
                          <button 
                            onClick={() => handleProtectedNavigation('/dashboard/stock-transfer')}
                            className={`block w-full text-left px-4 py-2 rounded-xl text-lg font-bold transition-all ${activeTab === 'stock-transfer' ? 'bg-red-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                          >
                            Transfert
                          </button>
                        </div>
                      )}
                    </div>
                    <NavItem icon={<Box size={20} />} label="Conversions" active={activeTab === 'conversions'} onClick={() => { navigate('/dashboard/conversions'); closeSidebar(); }} />
                    <NavItem icon={<Tag size={20} />} label="Catégories" active={activeTab === 'categories'} onClick={() => { navigate('/dashboard/categories'); closeSidebar(); }} />
                    <NavItem icon={<Building2 size={20} />} label="Dépôts" active={activeTab === 'depots'} onClick={() => { navigate('/dashboard/depots'); closeSidebar(); }} />
                  </div>
                </div>

                <div>
                  <p className="text-[14px] font-black text-gray-500 uppercase tracking-widest mb-3 px-4">Système</p>
                  <div className="space-y-1">
                    <NavItem icon={<Users size={20} />} label="Utilisateurs & Accès" active={activeTab === 'user-management'} onClick={() => { navigate('/dashboard/user-management'); closeSidebar(); }} />
                    <NavItem icon={<SettingsIcon size={20} />} label="Paramètres" active={activeTab === 'settings'} onClick={() => { navigate('/dashboard/settings'); closeSidebar(); }} />
                  </div>
                </div>
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-bold">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-lg font-bold text-white truncate">{session.user.email.split('@')[0]}</p>
              <p className="text-[14px] text-red-500 font-bold uppercase tracking-wider">
                {userRole === 'superAdmin' ? 'Super Administrateur' : 
                 userRole === 'serveur' ? 'Serveur' :
                 userRole === 'cuisine' ? 'Cuisine' :
                 userRole?.startsWith('Caissier') ? 'Caissier' : 'Personnel'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-500 hover:text-red-500 transition-colors w-full group"
          >
            <LogOut size={18} />
            <span className="font-bold text-lg">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-200 px-4 md:px-8 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
            <button
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >              <Menu size={24} />
            </button>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 capitalize truncate">
              {getTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5">
              <Building2 size={16} className="text-red-600" />
              <select 
                className="bg-transparent border-none text-base font-black text-gray-800 focus:ring-0 outline-none cursor-pointer"
                value={selectedDepotId}
                onChange={handleDepotChange}
              >
                {depots.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="relative w-40 md:w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher..."
                className="w-full bg-gray-100 border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-red-500/10"
                value={dashboardSearchTerm}
                onChange={(e) => setDashboardSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <button 
                className="relative text-gray-400 hover:text-red-600 p-2 transition-colors" 
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} />
                {stats.overdueCredits > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[14px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                    {stats.overdueCredits}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h4 className="text-[16px] font-black text-gray-800 uppercase tracking-widest">Alertes de Retard</h4>
                    <button onClick={() => setShowNotifications(false)}><X size={14} className="text-gray-400" /></button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {overdueList.length > 0 ? overdueList.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          handleViewClientCredit(item.factures?.clients?.name || item.factures?.guest_name);
                          setShowNotifications(false);
                        }}
                        className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-base font-black text-gray-800">{item.factures?.number}</p>
                          <p className="text-[15px] font-black text-red-600 uppercase">{new Date(item.date_echeance).toLocaleDateString()}</p>
                        </div>
                        <p className="text-[16px] font-bold text-gray-500 uppercase truncate">
                          {item.factures?.clients?.name || item.factures?.guest_name || 'Client Direct'}
                        </p>
                        <p className="text-lg font-black text-red-600 mt-1">{item.montant.toLocaleString()} Ar</p>
                      </div>
                    )) : (
                      <div className="p-10 text-center">
                        <CheckCircle2 size={32} className="text-gray-200 mx-auto mb-2" />
                        <p className="text-[16px] font-bold text-gray-400 uppercase tracking-widest">Aucun retard détecté</p>
                      </div>
                    )}
                  </div>
                  {overdueList.length > 0 && (
                    <button 
                      onClick={() => { navigate('/dashboard/deadlines'); setShowNotifications(false); }}
                      className="w-full py-3 bg-red-600 text-white text-[16px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
                    >
                      Voir tout l'échéancier
                    </button>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="lg:hidden p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className={`flex-1 overflow-hidden ${['pos', 'pos-simple', 'restaurant-order', 'restaurant-kitchen', 'restaurant-pos'].includes(activeTab) ? '' : 'p-4 md:p-6'}`}>
          <Routes>
            <Route path="/" element={
              userRole === 'superAdmin' ? (
                <div className="h-full overflow-y-auto pr-2 space-y-6 md:space-y-8">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <StatCard 
                      title="Ventes Menu" 
                      value={`${(stats?.totalSales || 0).toLocaleString('fr-MG')} MGA`} 
                      trend="+ Actuel" 
                      icon={<TrendingUp className="text-red-600" size={24} />} 
                    />
                    <StatCard 
                      title="Crédits Clients (Restant)" 
                      value={`${(stats?.totalClientCredits || 0).toLocaleString('fr-MG')} MGA`} 
                      trend="À encaisser" 
                      negative={true}
                      icon={<ArrowRightLeft className="text-orange-600" size={24} />} 
                    />
                    <StatCard 
                      title="Crédits Fournisseurs" 
                      value={`${(stats?.totalSupplierCredits || 0).toLocaleString('fr-MG')} MGA`} 
                      trend="À payer" 
                      negative={true}
                      icon={<Truck className="text-red-600" size={24} />} 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <StatCard 
                      title="Alertes Stock" 
                      value={`${stats?.stockAlerts || 0} articles`} 
                      trend={(stats?.stockAlerts || 0) > 0 ? "Réapprovisionner" : "Correct"} 
                      negative={(stats?.stockAlerts || 0) > 0} 
                      icon={<AlertCircle className={(stats?.stockAlerts || 0) > 0 ? "text-orange-600" : "text-gray-400"} size={24} />} 
                    />
                    <StatCard 
                      title="Factures payées" 
                      value={`${stats?.paidInvoices || 0}`} 
                      trend="Historique" 
                      icon={<CheckCircle2 className="text-red-600" size={24} />} 
                    />
                     <StatCard 
                      title="Crédits en retard" 
                      value={`${stats?.overdueCredits || 0}`} 
                      trend="Urgent" 
                      negative={true}
                      icon={<Clock className="text-red-600" size={24} />} 
                    />
                  </div>

                  {/* Recent Activity Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                      <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Package size={20} className="text-red-600" /> État du Stock
                      </h3>
                      <p className="text-gray-500 text-lg text-center py-10 font-medium">
                        {stats.stockAlerts > 0 
                          ? `Attention : ${stats.stockAlerts} produits sont en dessous du seuil critique.` 
                          : "Tout votre stock est actuellement suffisant."}
                      </p>
                      <button 
                        onClick={() => handleProtectedNavigation('/dashboard/inventory')}
                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-colors"
                      >
                        Gérer l'inventaire
                      </button>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                      <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Calendar size={20} className="text-red-600" /> Échéancier & Crédits
                      </h3>
                      <p className="text-gray-500 text-lg text-center py-10 font-medium">
                        {stats.pendingInvoices > 0 
                          ? `Vous avez ${stats.pendingInvoices} ventes à crédit en attente de paiement.` 
                          : "Toutes vos factures récentes sont réglées."}
                      </p>
                      <button 
                        onClick={() => navigate('/dashboard/deadlines')}
                        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-colors"
                      >
                        Voir l'échéancier
                      </button>
                    </div>
                  </div>
                </div>
              ) : userRole === 'serveur' ? (
                <Navigate to="/dashboard/restaurant-order" replace />
              ) : userRole === 'cuisine' ? (
                <Navigate to="/dashboard/restaurant-kitchen" replace />
              ) : userRole?.startsWith('Caissier') ? (
                <Navigate to="/dashboard/restaurant-pos" replace />
              ) : (
                <div className="flex items-center justify-center h-full">Chargement...</div>
              )
            } />
            
            {/* Protected Routes */}
            <Route path="restaurant-order" element={
              (userRole === 'superAdmin' || userRole === 'serveur') 
                ? <OrderTaker session={session} selectedDepotId={selectedDepotId} />
                : <Navigate to="/dashboard" replace />
            } />
            <Route path="restaurant-kitchen" element={
              (userRole === 'superAdmin' || userRole === 'cuisine') 
                ? <KitchenMonitor session={session} />
                : <Navigate to="/dashboard" replace />
            } />
            <Route path="restaurant-pos" element={
              (userRole === 'superAdmin' || userRole?.startsWith('Caissier')) 
                ? <RestaurantPOS session={session} selectedDepotId={selectedDepotId} />
                : <Navigate to="/dashboard" replace />
            } />
            
            {/* Admin Only Routes */}
            {userRole === 'superAdmin' && (
              <>
                <Route path="menus" element={<MenuManager />} />
                <Route path="products" element={<ProductList />} />
                <Route path="inventory" element={<Inventory selectedDepotId={selectedDepotId} />} />
                <Route path="stock-entry" element={<StockEntry />} />
                <Route path="categories" element={<Categories />} />
                <Route path="clients" element={<Clients onViewCredit={handleViewClientCredit} />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="supplier-history" element={<SupplierCreditHistory />} />
                <Route path="billing" element={<Billing 
                  initialSearchTerm={billingSearchTerm} 
                  onSearchReset={() => setBillingSearchTerm('')} 
                />} />
                <Route path="deadlines" element={<Deadlines 
                  initialSearchTerm={deadlineSearchTerm}
                  onSearchReset={() => setDeadlineSearchTerm('')}
                />} />
                <Route path="credit_history" element={<CreditHistory />} />
                <Route path="supplier_credits" element={<SupplierCredits />} />
                <Route path="decaissement" element={<Decaissement session={session} />} />
                <Route path="sales-analytics" element={<SalesDashboard />} />
                <Route path="historique" element={<StockHistory />} />
                <Route path="conversions" element={<Conversions session={session} />} />
                <Route path="depots" element={<Depots />} />
                <Route path="stock-transfer" element={<StockTransfer />} />
                <Route path="settings" element={<Settings session={session} />} />
                <Route path="user-management" element={<UserManagement session={session} />} />
              </>
            )}

            <Route path="pos" element={<POS session={session} selectedDepotId={selectedDepotId} />} />
            <Route path="pos-simple" element={<POSSimple session={session} selectedDepotId={selectedDepotId} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>

        {/* Admin Auth Modal */}
        {isAdminAuthOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-white p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl">
                    <h3 className="text-2xl font-black text-gray-800 uppercase">Code Administrateur</h3>
                    <p className="text-gray-500 font-bold">Veuillez saisir le code pour accéder à la gestion des stocks.</p>
                    <input 
                        type="password" 
                        placeholder="Code secret" 
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-4 text-2xl font-black outline-none" 
                        value={adminAuthCode} 
                        onChange={e => setAdminAuthCode(e.target.value)} 
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (adminAuthCode === dbAdminCode) {
                                    setIsAdminAuthenticated(true);
                                    setIsAdminAuthOpen(false);
                                    setAdminAuthCode('');
                                    if (pendingNavigation) {
                                        navigate(pendingNavigation);
                                        setPendingNavigation(null);
                                        closeSidebar();
                                    }
                                } else {
                                    alert("Code incorrect");
                                }
                            }
                        }}
                    />
                    <div className="flex gap-3">
                        <button onClick={() => { setIsAdminAuthOpen(false); setAdminAuthCode(''); setPendingNavigation(null); }} className="flex-1 py-4 font-bold text-gray-400">Annuler</button>
                        <button onClick={() => {
                            if (adminAuthCode === dbAdminCode) {
                                setIsAdminAuthenticated(true);
                                setIsAdminAuthOpen(false);
                                setAdminAuthCode('');
                                if (pendingNavigation) {
                                    navigate(pendingNavigation);
                                    setPendingNavigation(null);
                                    closeSidebar();
                                }
                            } else {
                                alert("Code incorrect");
                            }
                        }} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl">Valider</button>
                    </div>
                </div>
            </div>
        )}
       
      </main>
    </div>
  );
}



function NavItem({ icon, label, active = false, onClick, badge }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all w-full text-left ${
        active 
          ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' 
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-bold text-lg tracking-tight">{label}</span>
      {badge > 0 && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-red-600 text-white text-[16px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
            {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ title, value, trend, icon, negative = false }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-2">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className={`text-[15px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
          negative ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
        }`}>
          {trend}
        </span>
      </div>
      <p className="text-[16px] font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-black text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
