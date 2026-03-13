import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "https://deno.land/x/dotenv/load.ts";

/**
 * 🐘 LOCAL WORKER SERVER
 * Run this with: deno run --allow-net --allow-env --allow-read local-worker.ts
 * This will serve the Edge Function logic at http://localhost:8000
 */

const CONCURRENCY_LIMIT = 4;

const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Missing Supabase credentials in environment.");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("🚀 Local Worker started at http://localhost:8000");
console.log(`🔗 Connected to: ${supabaseUrl}`);

serve(async (req) => {
  const url = new URL(req.url);
  
  // Route matching the Edge Function path
  if (url.pathname.includes("/functions/v1/process-phase2-batch")) {
    try {
        const payload = await req.json().catch(() => ({}));
        const action = payload.action || 'orchestrate';

        console.log(`\n📦 [${new Date().toLocaleTimeString()}] Pulse Received: Action [${action}]`);

        // 1. Polling (Cleanup)
        await pollComfyUIJobs();

        // 2. Orchestration
        await orchestrateQueue();

        return new Response(JSON.stringify({ success: true }), { 
            headers: { "Content-Type": "application/json" } 
        });
    } catch (e: any) {
        console.error("❌ Worker Error:", e.message);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Not Found", { status: 404 });
}, { port: 8000 });

async function pollComfyUIJobs() {
    console.log("🔍 Checking Processing jobs for completion...");
    const { data: jobs } = await supabase.from('production_jobs').select('*').eq('status', 'Processing');
    console.log(`   Found ${jobs?.length || 0} jobs in Processing.`);
}

async function orchestrateQueue() {
    // 1. Calculate slots
    const { data: active } = await supabase.from('production_jobs').select('id').in('status', ['Queued', 'Processing']);
    const activeCount = active?.length || 0;
    const slotsToFill = CONCURRENCY_LIMIT - activeCount;

    console.log(`📊 Concurrency: ${activeCount}/4 slots used. Refilling ${Math.max(0, slotsToFill)} slots.`);

    if (slotsToFill <= 0) return;

    // 2. Fetch Pending
    const { data: pending } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true })
        .limit(slotsToFill);

    if (!pending || pending.length === 0) {
        console.log("   No more Pending jobs.");
        return;
    }

    // 3. Process
    for (const job of pending) {
        console.log(`\n➡️  Processing Job ${job.id} (Slot ${job.slot_index})`);
        await submitJob(job);
    }
}

async function submitJob(job: any) {
    try {
        // Pod Check
        const runpodKey = Deno.env.get("RUNPOD_API_KEY");
        const res = await fetch(`https://api.runpod.ai/v2/user/pod`, {
            headers: { 'Authorization': `Bearer ${runpodKey}` }
        });
        const pods = await res.json();
        const activePod = pods.find((p: any) => p.desiredStatus === 'RUNNING');

        if (!activePod) {
            throw new Error("NO_RUNNING_POD: No active pod found.");
        }

        console.log(`   ✅ Pod Found: ${activePod.id}. Submitting...`);
        
        // Mocking the ComfyUI submission for this test script so it stays in 'Processing' for user to see
        await supabase.from('production_jobs').update({ 
            status: 'Processing',
            comfyui_pod_id: activePod.id,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);
        
        console.log(`   ✨ Job ${job.id} is now PROCESSING.`);

    } catch (e: any) {
        console.log(`   ❌ FAILED: ${e.message}`);
        await supabase.from('production_jobs').update({ 
            status: 'Failed',
            error_message: e.message,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);
    }
}
