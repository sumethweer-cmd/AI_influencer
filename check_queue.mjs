import axios from 'axios';

const comfyUrl = 'https://7ty2x7yqk8eg0w-8188.proxy.runpod.net';

async function checkQueue() {
    try {
        const resp = await axios.get(`${comfyUrl}/queue`);
        const data = resp.data;
        console.log(`Queue Pending: ${data.queue_pending.length}`);
        console.log(`Queue Running: ${data.queue_running.length}`);

        if (data.queue_running.length > 0) {
            console.log("\nCurrently Running Job:");
            console.log(JSON.stringify(data.queue_running[0], null, 2).substring(0, 1000) + '...');
        }

    } catch (e) {
        console.error("Failed to query ComfyUI:", e.message);
    }
}

checkQueue();
