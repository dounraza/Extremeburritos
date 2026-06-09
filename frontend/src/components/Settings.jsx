import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserPlus, Building2, Save, Loader2, CheckCircle, Mail, Lock, User, MapPin, Phone, Hash } from 'lucide-react';

export default function Settings({ session }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Profile State
  const [profile, setProfile] = useState({
    company_name: '',
    address: '',
    phone: '',
    nif: '',
    stat: ''
  });

  // New User State
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchProfile();
    fetchUsers();
  }, []);

  const fetchProfile = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (data) {
      setProfile({
        company_name: data.company_name || '',
        address: data.address || '',
        phone: data.phone || '',
        nif: data.nif || '',
        stat: data.stat || ''
      });
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (error) {
      console.error("Erreur récupération utilisateurs:", error);
      return;
    }
    if (data) setUsers(data);
  };

  const updateRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      if (error) throw error;
      fetchUsers();
      setSuccessMessage('Rôle mis à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(profile)
        .eq('id', session.user.id);

      if (error) throw error;
      setSuccessMessage('Profil mis à jour !');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Récupérer le rôle de l'admin actuel
      const { data: adminData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      // 2. Créer l'utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password
      });

      if (authError) throw authError;

      // 3. Insérer le rôle dans user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert([{ user_id: authData.user.id, role: adminData?.role || 'user' }]);

      if (roleError) throw roleError;

      setSuccessMessage('Utilisateur et rôle créés avec succès !');
      setNewUser({ email: '', password: '', fullName: '' });
      fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-[2rem] border border-gray-50 shadow-sm overflow-x-auto">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-base font-black transition-all ${activeTab === 'profile' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Building2 size={18} /> INFOS
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-2xl text-base font-black transition-all ${activeTab === 'users' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <UserPlus size={18} /> UTILISATEURS
        </button>
      </div>

      {successMessage && (
        <div className="bg-gray-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          <span className="font-bold text-lg">{successMessage}</span>
        </div>
      )}

      <div className="bg-white/60 backdrop-blur-md border border-gray-50 rounded-[2.5rem] p-8 md:p-12 shadow-sm">
        {activeTab === 'profile' ? (
          <form onSubmit={handleUpdateProfile} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom de l'entreprise</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <input 
                    type="text" required
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                    value={profile.company_name}
                    onChange={(e) => setProfile({...profile, company_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Adresse</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                    value={profile.address}
                    onChange={(e) => setProfile({...profile, address: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">NIF</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                    value={profile.nif}
                    onChange={(e) => setProfile({...profile, nif: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">STAT</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                  <input 
                    type="text"
                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                    value={profile.stat}
                    onChange={(e) => setProfile({...profile, stat: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <button 
              type="submit" disabled={loading}
              className="w-full md:w-auto px-12 py-4 bg-red-600 text-white rounded-2xl font-black text-base uppercase tracking-[0.2em] shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Enregistrer les infos</>}
            </button>
          </form>
        ) : (
          <div className="space-y-12">
            <form onSubmit={handleCreateUser} className="space-y-8">
              <div className="space-y-6 max-w-lg mx-auto">
                <div className="space-y-2">
                  <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom complet</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                      type="text" required
                      className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                      type="email" required
                      className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[16px] font-black text-gray-400 uppercase tracking-widest ml-1">Mot de passe provisoire</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                      type="password" required minLength={6}
                      className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold focus:ring-4 focus:ring-red-500/20 outline-none transition-all"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit" disabled={loading}
                  className="w-full px-12 py-4 bg-red-600 text-white rounded-2xl font-black text-base uppercase tracking-[0.2em] shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Créer l'utilisateur</>}
                </button>
              </div>
            </form>

            <div className="border-t border-gray-50 pt-8 mt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-black text-gray-500 uppercase">Configuration Sécurité</h3>
                <button 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const { error } = await supabase.rpc('enable_read_access_for_all');
                      if (error) throw error;
                      alert('Accès en lecture ouvert pour toutes les tables !');
                    } catch (err) {
                      alert('Erreur : ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-base hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Application...' : 'Ouvrir accès Lecture Total'}
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-[16px] text-gray-400 uppercase text-left">
                    <th className="pb-4">Utilisateur</th>
                    <th className="pb-4">Rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => (
                    <tr key={u.user_id}>
                      <td className="py-4">
                        <div className="text-lg font-bold text-gray-800">{u.user_id}</div>
                      </td>
                      <td className="py-4">
                        <select value={u.role} onChange={(e) => updateRole(u.user_id, e.target.value)} className="bg-gray-50 text-red-600 font-bold text-base rounded-lg py-1 px-2 cursor-pointer outline-none">
                          <option value="user">Utilisateur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

