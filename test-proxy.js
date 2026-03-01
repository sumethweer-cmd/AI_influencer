const axios = require('axios');

async function pingProxy() {
    const podId = 'b1053uo8wq3nrs';
    const port = 8188;
    const comfyUrl = `https://${podId}-${port}.proxy.runpod.net`;

    console.log(`Pinging ${comfyUrl}/system_stats...`);
    try {
        const res = await axios.get(`${comfyUrl}/system_stats`, { timeout: 10000 });
        console.log("Success! Proxy responded:", Object.keys(res.data));
    } catch (err) {
        console.error("Failed to ping:", err.message);
    }
}

pingProxy().catch(console.error);
