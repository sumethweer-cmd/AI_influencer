const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
s.from('system_logs').select().limit(1).then(r => {
    if (r.data && r.data.length > 0) {
        console.log("Columns:", Object.keys(r.data[0]));
    } else {
        console.log("No data in system_logs");
    }
});
