import axios from 'axios';

const comfyUrl = 'https://7ty2x7yqk8eg0w-8188.proxy.runpod.net';

async function checkHistory() {
    try {
        const resp = await axios.get(`${comfyUrl}/history`);
        const keys = Object.keys(resp.data);
        console.log(`Total History Items: ${keys.length}`);

        // Let's print the last 2 items
        if (keys.length > 0) {
            for (let i = keys.length - 1; i >= Math.max(0, keys.length - 3); i--) {
                const k = keys[i];
                console.log(`\nHistory for Prompt ${k}:`);
                const item = resp.data[k];
                console.log(`Status:`, item.status);
                // Check if outputs has any nodes
                const outputKeys = Object.keys(item.outputs || {});
                console.log(`Outputs keys count: ${outputKeys.length}`);
                if (outputKeys.length > 0) {
                    console.log(`First output:`, item.outputs[outputKeys[0]]);
                }
            }
        }

    } catch (e) {
        console.error("Failed to query ComfyUI:", e.message);
    }
}

checkHistory();
