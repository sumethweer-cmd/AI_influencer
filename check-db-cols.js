const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkColumns() {
    const { data, error } = await supabase.from('comfyui_workflows').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log('Columns in comfyui_workflows:', Object.keys(data[0]));
    }
}

checkColumns();
