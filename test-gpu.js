const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function getGpuTypes() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

    if (!urlMatch || !keyMatch) {
        console.log('Supabase Keys not found'); return;
    }

    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

    const { data } = await supabase.from('system_configs').select('key_value').eq('key_name', 'RUNPOD_API_KEY').single();
    if (!data) return console.log("Runpod key not in db");
    const key = data.key_value;
    console.log("Found key length", key.length);

    const query = `
      query {
        gpuTypes {
          id
          displayName
        }
      }
    `;
    const res = await fetch('https://api.runpod.io/graphql?api_key=' + key, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
    });
    const json = await res.json();
    console.log(JSON.stringify(json.data.gpuTypes.filter((g) => g.id.includes('5090') || g.id.includes('4090') || g.id.includes('3090')), null, 2));
}
getGpuTypes().catch(console.error);
