const axios = require('axios');

async function guessEndpoints() {
    const baseUrl = 'https://b1053uo8wq3nrs-8188.proxy.runpod.net';
    const subpaths = [
        '',
        '/api',
        '/comfyui',
        '/comfyui/api',
        '/comfy',
        '/run',
        '/api/v1'
    ];

    for (const sub of subpaths) {
        console.log(`Trying ${baseUrl}${sub}/history...`);
        try {
            const res = await axios.get(`${baseUrl}${sub}/history`, { timeout: 3000 });
            console.log(`🎉 Found! Base URL is ${baseUrl}${sub}`);
            return;
        } catch (e) {
            console.log(`   [Failed] ${e.response ? e.response.status : e.message}`);
        }
    }
}
guessEndpoints().catch(console.error);
