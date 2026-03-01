const axios = require('axios');

async function checkHistory() {
    const comfyUrl = 'https://b1053uo8wq3nrs-8188.proxy.runpod.net';
    console.log(`Fetching history from ${comfyUrl}/history...`);

    try {
        const response = await axios.get(`${comfyUrl}/history`);
        const history = response.data;
        const promptIds = Object.keys(history);

        if (promptIds.length > 0) {
            const firstJob = history[promptIds[0]];
            console.log("Found Job:", promptIds[0]);
            console.log("Outputs:", JSON.stringify(firstJob.outputs, null, 2));
        } else {
            console.log("No history found.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkHistory().catch(console.error);
