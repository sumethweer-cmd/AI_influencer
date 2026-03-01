
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const { count, error: countError } = await supabase.from('generated_images').select('*', { count: 'exact', head: true });
    if (countError) {
        console.error('Count Error:', countError);
    } else {
        console.log('Total images in DB:', count);
    }

    const { data, error } = await supabase.from('generated_images').select('*').limit(5);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Sample image records:', JSON.stringify(data, null, 2));
}

checkData();
