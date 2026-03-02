import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLogs() {
    const { data: logs, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log("=== LATEST 20 LOGS ===");
    for (const log of logs) {
        if (log.level === 'ERROR') {
            console.log(`\x1b[31m[${log.created_at}] [${log.level}] ${log.action}: ${log.message}\x1b[0m`);
            if (log.metadata) console.log(`  > ${JSON.stringify(log.metadata)}`);
        } else {
            console.log(`[${log.created_at}] [${log.level}] ${log.action}: ${log.message}`);
        }
    }
}

checkLogs();
