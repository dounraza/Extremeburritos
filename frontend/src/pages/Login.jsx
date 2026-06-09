import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { data, error } = isSignUp 
      ? await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
    } else if (isSignUp) {
      alert('Vérifiez vos e-mails pour confirmer l\'inscription !');
    } else if (data?.user) {
      // Récupérer le dépôt associé
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('depot_id')
        .eq('user_id', data.user.id)
        .single();
      
      if (userRole?.depot_id) {
        localStorage.setItem('user_depot_id', userRole.depot_id);
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-black font-sans overflow-hidden">
      {/* Background Image (Slightly more visible on black) */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.1] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000&auto=format&fit=crop')" }}
      ></div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Conteneur sombre et propre */}
        <div className="bg-black-900 border border-gray-800 rounded-[2rem] shadow-2xl p-10">
          <div className="text-center mb-10">
            <div className="mb-4 flex justify-center">
              <img src="/logo.jpeg" alt="Logo" className="w-24 h-32 rounded-3xl object-cover shadow-xl shadow-black/50" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              <span className="text-white">Extrême</span><span className="text-red-600"> Buritos</span>
            </h2>
            <p className="mt-1 text-gray-400 text-lg">
              Logiciel de gestion Restaurant
            </p>
          </div>


          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-base font-bold text-gray-400 uppercase ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="email"
                  required
                  className="w-full bg-black border border-gray-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:bg-black transition-all"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-base font-bold text-gray-400 uppercase ml-1">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                <input
                  type="password"
                  required
                  className="w-full bg-black border border-gray-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:bg-black transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg  flex items-center justify-center gap-2 group transition-all mt-6 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? "S'inscrire" : "Se connecter"}</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* <div className="mt-8 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-lg font-medium text-red-600 hover:text-red-800 transition-colors"
            >
              {isSignUp ? "Déjà inscrit ? Connexion" : "Nouveau gestionnaire ? Créer un profil"}
            </button>
          </div> */}
        </div>
        
        <p className="mt-8 text-center text-base text-gray-400 font-medium">
          © 2026 Extrême Buritos — Système d'Inventaire
        </p>
      </div>
    </div>
  );
}
