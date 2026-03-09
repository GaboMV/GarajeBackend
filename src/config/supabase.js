const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Usar Service Role Key preferiblemente para el backend

if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase no está configurado. Revisa tus variables de entorno.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
