import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, Search, Shield } from 'lucide-react';

export default function Historique() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('historique')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching logs:", error);
    } else {
        console.log("Fetched logs:", data);
        setLogs(data);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Shield className="text-red-600" /> Historique des Actions
        </h1>
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Rechercher..." 
                className="w-full p-3 pl-10 rounded-xl border border-slate-200 text-lg outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
            <p className="text-center py-10 text-slate-400">Chargement...</p>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[16px] font-black">
                    <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Module</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Utilisateur</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLogs.map(log => (
                        <tr key={log.id} className="text-[15px] text-slate-700 hover:bg-slate-50">
                            <td className="p-4 font-bold whitespace-nowrap">
                                {new Date(log.created_at).toLocaleString()}
                            </td>
                            <td className="p-4 uppercase font-black text-[15px] text-red-600">{log.module}</td>
                            <td className="p-4 font-bold">{log.action}</td>
                            <td className="p-4 text-slate-500">{log.profiles?.full_name || 'Système'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
}

