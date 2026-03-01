const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

async function testActive() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

    if (!urlMatch || !keyMatch) { return; }

    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
    const { data } = await supabase.from('system_configs').select('key_value').eq('key_name', 'RUNPOD_API_KEY').single();
    if (!data) return;
    const key = data.key_value;

    const query = `
      query {
        myself {
          pods {
            id
            name
            desiredStatus
            runtime {
              ports {
                ip
                isIpPublic
                privatePort
                publicPort
              }
            }
          }
        }
      }
    `;

    try {
        const response = await axios.post('https://api.runpod.io/graphql', { query }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            }
        });
        console.log(JSON.stringify(response.data.data.myself.pods, null, 2));
    } catch (err) {
        if (err.response) {
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err);
        }
    }
}
testActive().catch(console.error);
