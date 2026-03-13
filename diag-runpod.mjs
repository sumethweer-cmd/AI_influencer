import 'dotenv/config';
import fetch from 'node-fetch';

async function getActivePods() {
    const key = process.env.RUNPOD_API_KEY;
    
    if (!key || key === 'your_runpod_api_key_here') {
        console.error("❌ ERROR: RUNPOD_API_KEY in .env.local is missing or has a placeholder value.");
        return;
    }

    console.log(`🔍 Checking Runpod API with key: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);

    const query = `{ myself { pods { id desiredStatus lastStatus } } }`;
    try {
        const response = await fetch('https://api.runpod.io/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ query })
        });
        
        const json = await response.json();
        
        if (json.errors) {
            console.error("❌ Runpod API Error:", json.errors[0].message);
            return;
        }

        const pods = json.data?.myself?.pods || [];
        console.log(`✅ Success! Found ${pods.length} pods.`);
        
        pods.forEach((p, i) => {
            const isDesiredStatusRunning = p.desiredStatus?.toUpperCase() === 'RUNNING';
            console.log(`   [${i + 1}] Pod ID: ${p.id}`);
            console.log(`       Desired Status: ${p.desiredStatus} ${isDesiredStatusRunning ? '✅ (Desired: RUNNING)' : '❌ (Desired: Not RUNNING)'}`);
            console.log(`       Last Status: ${p.lastStatus}`);
        });

        if (pods.length === 0) {
            console.warn("⚠️ WARNING: No pods found for this account.");
        } else {
            const running = pods.find(p => p.desiredStatus?.toUpperCase() === 'RUNNING');
            if (!running) {
                console.warn("⚠️ WARNING: None of the pods are currently in 'RUNNING' status.");
            }
        }
    } catch (e) {
        console.error("❌ Network/Fetch Error:", e.message);
    }
}

getActivePods();
