
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const { data: content, error: e1 } = await supabase.from('content_items').select('*').eq('id', '3a78c058-b3c4-486b-a222-89333d9f2bcc').single();
    if (e1) console.log('Content Item Error:', e1.message);
    else console.log('Content Item Found:', content.id);

    const { data: img, error: e2 } = await supabase.from('generated_images').select('*').eq('id', 'f926770f-dfd6-4a0a-8f8b-587be2bb0625').single();
    if (e2) console.log('Image Error:', e2.message);
    else console.log('Image Found:', img.id);
}

checkData();
