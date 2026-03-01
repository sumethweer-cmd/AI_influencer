const axios = require('axios');

async function testPromptAPI() {
    const comfyUrl = 'https://b1053uo8wq3nrs-8188.proxy.runpod.net';
    console.log(`Pinging ${comfyUrl}/prompt...`);

    try {
        const response = await axios.post(`${comfyUrl}/prompt`, {
            prompt: { "1": { "class_type": "DummyNode" } },
            client_id: 'nong_kung_agency'
        });
        console.log("Success:", response.data);
    } catch (err) {
        if (err.response) {
            console.error("404 Error Data:", err.response.status, err.response.data);
        } else {
            console.error("Error:", err.message);
        }
    }
}

testPromptAPI().catch(console.error);
