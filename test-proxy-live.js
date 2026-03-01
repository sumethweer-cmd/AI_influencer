const axios = require('axios');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function checkProxy() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)
    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
    const { data } = await supabase.from('system_configs').select('key_value').eq('key_name', 'RUNPOD_API_KEY').single();
    const key = data.key_value;

    const query = `{
        myself {
          pods {
            id name desiredStatus
            runtime { ports { ip isIpPublic privatePort publicPort } }
          }
        }
    }`;
    const response = await axios.post('https://api.runpod.io/graphql', { query }, {
        headers: { 'Authorization': `Bearer ${key}` }
    });

    const pod = response.data.data.myself.pods.find(p => p.desiredStatus === 'RUNNING');
    if (!pod) return console.log('No running pods');

    const port8188 = pod.runtime.ports.find(p => p.privatePort === 8188);
    const comfyUrl = port8188.isIpPublic ?
        `http://${port8188.ip}:${port8188.publicPort}` :
        `https://${pod.id}-8188.proxy.runpod.net`;

    console.log(`Detected ComfyUI URL: ${comfyUrl}`);

    try {
        const stats = await axios.get(`${comfyUrl}/system_stats`, { timeout: 3000 });
        console.log('System Stats:', Object.keys(stats.data));

        const history = await axios.get(`${comfyUrl}/history`, { timeout: 3000 });
        console.log('History keys:', Object.keys(history.data));
    } catch (err) {
        console.log('Error hitting Comfy URL:', err.response ? err.response.status : err.message);
    }
}
checkProxy().catch(console.error);
