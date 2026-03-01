require('dotenv').config({ path: '.env.local' });
// Register ts-node for TypeScript execution since production-runner is .ts
require('ts-node').register({
    compilerOptions: {
        module: 'commonjs',
        target: 'es2022',
        esModuleInterop: true,
        allowJs: true,
        paths: {
            "@/*": ["./*"]
        },
        baseUrl: "."
    }
});
const { runProductionBatch } = require('./jobs/production-runner');

async function testPhase2() {
    console.log("Starting local Phase 2...");
    const result = await runProductionBatch();
    console.log("Result:", result);
}
testPhase2().catch(console.error);
