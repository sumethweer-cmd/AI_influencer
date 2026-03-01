const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

async function checkLogs() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

    if (!urlMatch || !keyMatch) {
        return console.log('Keys not found');
    }

    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
    const { data } = await supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(20);
    console.log(JSON.stringify(data, null, 2));
}

checkLogs().catch(console.error);
