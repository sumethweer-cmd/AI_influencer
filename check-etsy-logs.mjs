import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEtsyLogs() {
    console.log("🔍 Checking Etsy logs...");
    const { data: logs, error } = await supabase
        .from('system_logs')
        .select('*')
        .or('phase.ilike.%etsy%,message.ilike.%etsy%')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    if (logs.length === 0) {
        console.log("✅ No specific Etsy errors or activity found in systemic logs recently.");
        return;
    }

    console.log(`=== LATEST ${logs.length} ETSY LOGS ===`);
    for (const log of logs) {
        const color = log.level === 'ERROR' ? '\x1b[31m' : '\x1b[36m';
        console.log(`${color}[${log.created_at}] [${log.level}] ${log.phase || log.action}: ${log.message}\x1b[0m`);
    }
}

checkEtsyLogs();
