const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

async function checkJobs() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

    if (!urlMatch || !keyMatch) {
        return console.log('Keys not found');
    }

    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
    const { data } = await supabase.from('production_jobs').select('*');
    console.log(JSON.stringify(data, null, 2));
}

checkJobs().catch(console.error);
