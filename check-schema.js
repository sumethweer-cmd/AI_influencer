const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: cols1 } = await s.rpc('get_column_details', { table_name: 'content_items' });
    console.log("content_items:", cols1?.map(c => c.column_name));

    const { data: cols2 } = await s.rpc('get_column_details', { table_name: 'generated_images' });
    console.log("generated_images:", cols2?.map(c => c.column_name));
}
// If RPC not available, try direct query on first row
async function checkDirect() {
    const { data: d1 } = await s.from('content_items').select().limit(1);
    if (d1 && d1[0]) console.log("content_items:", Object.keys(d1[0]));

    const { data: d2 } = await s.from('generated_images').select().limit(1);
    if (d2 && d2[0]) console.log("generated_images:", Object.keys(d2[0]));
}
checkDirect();
