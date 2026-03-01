
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
    console.log('Using Service Role Key on:', supabaseUrl);
    const { data: content, error: e1 } = await supabase.from('content_items').select('*');
    if (e1) {
        console.log('Content Item Error:', e1);
    } else {
        console.log('Content Items Count:', content.length);
    }

    const { data: img, error: e2 } = await supabase.from('generated_images').select('*');
    if (e2) {
        console.log('Image Error:', e2);
    } else {
        console.log('Images Count:', img.length);
        if (img.length > 0) {
            console.log('First image path:', img[0].file_path);
        }
    }
}

checkData();
