
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const { data, error } = await supabase.from('generated_images').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Sample image record:', JSON.stringify(data[0], null, 2));
}

checkData();
