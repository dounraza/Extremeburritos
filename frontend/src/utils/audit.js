import { supabase } from '../supabaseClient';

export const logAction = async (action, module, targetId = null, details = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('historique').insert([{
      action,
      module,
      target_id: targetId,
      details,
      user_id: user?.id
    }]);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de l'historique:", error);
  }
};
