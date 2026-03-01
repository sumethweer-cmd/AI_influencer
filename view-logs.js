const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabaseAdmin
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching logs:", error.message);
        return;
    }

    console.log("LAST 5 LOGS:");
    data.forEach(log => {
        console.log(`[${log.created_at}] [${log.level}] [${log.phase}] ${log.message}`);
        if (log.metadata) {
            console.log("Metadata:", JSON.stringify(log.metadata, null, 2));
        }
        console.log("---");
    });
}

run();
