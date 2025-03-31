import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './constants';

const supabase = createClient(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseKey
);

export default supabase; 