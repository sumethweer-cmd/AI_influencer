// /test-configs.js
async function run() {
    console.log("Fetching configs to trigger seeding...");
    const res = await fetch('http://localhost:3000/api/configs');
    const json = await res.json();
    console.log("Configs fetched:", json.data?.length || 0);

    const phase1Sys = json.data?.find(c => c.key_name === 'PHASE1_SYSTEM_INSTRUCTION');
    const phase1Json = json.data?.find(c => c.key_name === 'PHASE1_JSON_SCHEMA');

    if (phase1Sys && phase1Json) {
        console.log("✅ New Phase 1 configs successfully retrieved!");
        console.log("System Instruction key exists:", !!phase1Sys.key_value);
        console.log("JSON Schema key exists:", !!phase1Json.key_value);
    } else {
        console.error("❌ Failed to find new Phase 1 configs. They might not have seeded correctly if the table wasn't empty.");
        console.log("Available keys:", json.data?.map(c => c.key_name));
    }
}
run();
