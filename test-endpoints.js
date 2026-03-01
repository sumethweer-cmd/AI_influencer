const axios = require('axios');

async function testPromptAPI() {
    const comfyUrl = 'https://b1053uo8wq3nrs-8188.proxy.runpod.net';

    const endpoints = [
        { method: 'GET', path: '/system_stats' },
        { method: 'GET', path: '/object_info' },
        { method: 'GET', path: '/history' },
        { method: 'GET', path: '/queue' }
    ];

    for (const ep of endpoints) {
        try {
            const res = await axios({ method: ep.method, url: `${comfyUrl}${ep.path}`, timeout: 5000 });
            console.log(`[Success] ${ep.method} ${ep.path}:`, Object.keys(res.data || {}).slice(0, 5));
        } catch (err) {
            console.error(`[Error] ${ep.method} ${ep.path}:`, err.response ? err.response.status : err.message);
        }
    }
}

testPromptAPI().catch(console.error);
