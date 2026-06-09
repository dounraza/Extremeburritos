import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <Login /> : <Navigate to="/dashboard/restaurant-pos" />} 
        />
        <Route 
          path="/dashboard/*" 
          element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} 
        />
        <Route path="/" element={<Navigate to={session ? "/dashboard/restaurant-pos" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
