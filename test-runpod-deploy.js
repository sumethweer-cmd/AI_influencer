const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function testDeploy() {
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

    const query = `
    mutation {
      podFindAndDeployOnDemand(
        input: {
          cloudType: ALL,
          gpuCount: 1,
          gpuTypeId: "NVIDIA GeForce RTX 4090",
          name: "Test-Omit-Image",
          templateId: "2lv7ev3wfp",
          volumeInGb: 0,
          containerDiskInGb: 20
        }
      ) { id imageName machineId }
    }
    `;

    const res = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({ query })
    });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2));

    // terminate if success
    if (json.data && json.data.podFindAndDeployOnDemand && json.data.podFindAndDeployOnDemand.id) {
        console.log("Terminating test pod...");
        const id = json.data.podFindAndDeployOnDemand.id;
        const tQuery = `mutation { podTerminate(input: {podId: "${id}"}) }`
        await fetch('https://api.runpod.io/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ query: tQuery })
        });
        console.log("Terminated");
    }
}
testDeploy().catch(console.error);
