const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function testQuery() {
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

    const { data: tData } = await supabase.from('system_configs').select('key_value').eq('key_name', 'RUNPOD_TEMPLATE_ID').single();
    const templateId = tData ? tData.key_value : 'null';
    console.log("Template ID:", templateId);

    const query = `
      query {
        __type(name: "PodDeployOnDemandInput") {
          fields {
            name
            type { name, kind, ofType { name, kind } }
          }
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
    console.log(JSON.stringify(json.data.__type.fields.filter(f => f.name === 'imageName' || f.name === 'templateId'), null, 2));
}
testQuery().catch(console.error);
