import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Shield, User, Mail, Lock, Building2, Trash2, Loader2, CheckCircle, Search, AlertCircle } from 'lucide-react';

export default function UserManagement({ session }) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [depots, setDepots] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'serveur',
    depot_id: ''
  });

  const roles = [
    { value: 'superAdmin', label: 'Super Administrateur' },
    { value: 'Caissier', label: 'Caissier' },
    { value: 'serveur', label: 'Serveur' },
    { value: 'cuisine', label: 'Cuisine' }
  ];

  useEffect(() => {
    fetchUsers();
    fetchDepots();
  }, []);

  const fetchUsers = async () => {
    try {
      // We fetch from user_roles and join with profiles to get the full name
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          id,
          user_id,
          role,
          depot_id,
          depots(name),
          profiles:user_id(full_name)
        `);

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const fetchDepots = async () => {
    const { data } = await supabase.from('depots').select('id, name').order('name');
    if (data) setDepots(data);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Note: Using signUp will likely sign out the current admin in standard Supabase config
      // unless email confirmation is required and the admin is using a specific Auth client.
      // However, we follow the pattern established in the project.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create user_role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ 
            user_id: authData.user.id, 
            role: formData.role,
            depot_id: formData.depot_id || null
          }]);

        if (roleError) throw roleError;

        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: authData.user.id,
            full_name: formData.fullName
          }]);
        
        // profileError might be ignored if it fails due to existing profile or trigger
      }

      setSuccessMessage('Utilisateur créé avec succès !');
      setFormData({ email: '', password: '', fullName: '', role: 'serveur', depot_id: '' });
      fetchUsers();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (roleId, newRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', roleId);
      if (error) throw error;
      fetchUsers();
      setSuccessMessage('Rôle mis à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const updateDepot = async (roleId, newDepotId) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ depot_id: newDepotId || null })
        .eq('id', roleId);
      if (error) throw error;
      fetchUsers();
      setSuccessMessage('Dépôt mis à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const deleteAccess = async (roleId) => {
    if (confirm('Voulez-vous vraiment supprimer cet accès ? L\'utilisateur ne pourra plus se connecter.')) {
      try {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('id', roleId);
        if (error) throw error;
        fetchUsers();
        setSuccessMessage('Accès supprimé !');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (err) {
        setErrorMessage(err.message);
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-800 uppercase tracking-tight">Gestion des Accès</h1>
          <p className="text-gray-500 font-bold mt-1 uppercase tracking-widest text-sm">Contrôle des rôles et utilisateurs</p>
        </div>
      </div>

      {(successMessage || errorMessage) && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${successMessage ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {successMessage ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-lg">{successMessage || errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create User Form */}
        <div className="lg:col-span-1 bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm h-fit">
          <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3 uppercase">
            <UserPlus className="text-red-600" size={24} /> Nouveau Compte
          </h2>
          
          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" required
                  placeholder="Jean Dupont"
                  className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all"
                  value={formData.fullName}
                  onChange={e => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="email" required
                  placeholder="email@restaurant.com"
                  className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" required minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Rôle</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all appearance-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Dépôt Affecté</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-base font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all appearance-none"
                  value={formData.depot_id}
                  onChange={e => setFormData({...formData, depot_id: e.target.value})}
                >
                  <option value="">Tous les dépôts</option>
                  {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Créer le compte</>}
            </button>
            <p className="text-[10px] text-gray-400 font-bold uppercase text-center mt-4 leading-relaxed">
              Note: L'administrateur peut être déconnecté lors de la création directe. Préférez l'utilisation d'une navigation privée pour les tests.
            </p>
          </form>
        </div>

        {/* User List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-gray-800 uppercase">Utilisateurs Actifs</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Rechercher..."
                  className="w-full bg-gray-50 border-0 rounded-xl py-2 pl-10 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-black text-gray-400 uppercase text-left border-b border-gray-50">
                    <th className="pb-4 px-2">Utilisateur</th>
                    <th className="pb-4 px-2">Rôle</th>
                    <th className="pb-4 px-2">Dépôt</th>
                    <th className="pb-4 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="group hover:bg-gray-50/50 transition-all">
                      <td className="py-4 px-2">
                        <div className="font-black text-gray-800 text-base">{u.profiles?.full_name || 'Sans Nom'}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter truncate w-32">{u.user_id}</div>
                      </td>
                      <td className="py-4 px-2">
                        <select 
                          value={u.role} 
                          onChange={(e) => updateRole(u.id, e.target.value)}
                          className="bg-red-50 text-red-600 font-black text-xs rounded-full py-1.5 px-3 cursor-pointer outline-none border-0 uppercase"
                        >
                          {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          <option value="Caissier1">Caissier 1</option>
                          <option value="Caissier2">Caissier 2</option>
                        </select>
                      </td>
                      <td className="py-4 px-2">
                        <select 
                          value={u.depot_id || ''} 
                          onChange={(e) => updateDepot(u.id, e.target.value)}
                          className="bg-gray-50 text-gray-600 font-black text-xs rounded-full py-1.5 px-3 cursor-pointer outline-none border-0 uppercase"
                        >
                          <option value="">Tous</option>
                          {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button 
                          onClick={() => deleteAccess(u.id)}
                          className="p-2 text-gray-300 hover:text-red-600 transition-colors"
                          title="Supprimer l'accès"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-20 text-center">
                        <User className="mx-auto text-gray-100 mb-4" size={48} />
                        <p className="text-gray-400 font-black uppercase tracking-widest">Aucun utilisateur trouvé</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
