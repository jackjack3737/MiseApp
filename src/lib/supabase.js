import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto'; // Serve per evitare crash su alcuni telefoni

const SUPABASE_URL = "https://bfmrnfnhskcgvhitpzuh.supabase.co";
const SUPABASE_KEY = "sb_publishable_UXABf053HGuNjTSOQvAhfQ_mjXwtkV0"; // La tua chiave pubblica

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);