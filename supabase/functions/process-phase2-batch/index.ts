import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Types & Constants ---
const CONCURRENCY_LIMIT = 4;
const STALE_THRESHOLD_MINUTES = 8; // Legacy timeout

interface Job {
    id: string;
    content_item_id: string;
    image_type: string;
    slot_index: number;
    prompt_text: string;
    status: string;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper: Logging ---
async function logSystem(supabase: any, level: string, phase: string, message: string, metadata: any = {}) {
    console.log(`[${level}] ${phase}: ${message}`, JSON.stringify(metadata));
    await supabase.from('system_logs').insert({ level, phase, message, metadata });
}

// --- Helper: Runpod API ---
async function getActivePods(apiKey: string) {
    const res = await fetch(`https://api.runpod.ai/v2/user/pod`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) throw new Error(`Runpod API Error: ${res.statusText}`);
    const data = await res.json();
    // Return all pods so we can log them for debugging
    return Array.isArray(data) ? data : [];
}

// --- Main Handler ---
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        const payload = await req.json().catch(() => ({}));
        const action = payload.action || 'orchestrate';

        console.log(`--- Worker Wakeup: Action [${action}] ---`);

        // 1. POLL: Check for completed jobs (Cleanup)
        await pollComfyUIJobs(supabase);

        // 2. ORCHESTRATE: Constant Refill to 4
        if (action === 'orchestrate' || action === 'watchdog') {
            await orchestrateQueue(supabase);
        }

        return new Response(JSON.stringify({ success: true, message: 'Orchestration complete' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error("Worker Crash:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

/**
 * Ensures exactly 4 jobs are in 'Processing' status by pulling from 'Pending'
 */
async function orchestrateQueue(supabase: any) {
    // A. Check current Processing count
    const { data: activeJobs } = await supabase
        .from('production_jobs')
        .select('id')
        .in('status', ['Queued', 'Processing']);
    
    const currentActiveCount = activeJobs?.length || 0;
    const slotsToFill = CONCURRENCY_LIMIT - currentActiveCount;

    console.log(`Queue Status: ${currentActiveCount}/4 slots active. Attempting to fill ${slotsToFill} slots.`);

    if (slotsToFill <= 0) return;

    // B. Fetch Pending jobs
    const { data: pendingJobs } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true })
        .limit(slotsToFill);

    if (!pendingJobs || pendingJobs.length === 0) {
        console.log("No pending jobs to fill slots.");
        return;
    }

    // C. Process each synchronously (Sequential for reliability)
    for (const job of pendingJobs) {
        console.log(`Starting job ${job.id} (Slot ${job.slot_index})`);
        await submitJobToComfyUI(supabase, job);
    }
}

/**
 * Submits a single job to Runpod/ComfyUI
 * Moves Pending -> Processing (or Failed if no pod)
 */
async function submitJobToComfyUI(supabase: any, job: Job) {
    try {
        // 1. Get API Key
        const { data: config } = await supabase.from('system_configs').select('key_value').eq('key_name', 'RUNPOD_API_KEY').single();
        const runpodKey = config?.key_value || Deno.env.get('RUNPOD_API_KEY');
        if (!runpodKey) throw new Error("Missing RUNPOD_API_KEY");

        // 2. Fetch Content Item & Workflow
        const { data: item } = await supabase.from('content_items').select('*').eq('id', job.content_item_id).single();
        if (!item) throw new Error("Content item not found");

        const workflows = await supabase.from('comfyui_workflows').select('*');
        let selectedWf = workflows.data?.find((w: any) => w.id === item.selected_workflow_id);
        if (!selectedWf) {
            const personaMatches = workflows.data?.filter((w: any) => w.persona === item.persona);
            selectedWf = (personaMatches?.length ? personaMatches : workflows.data!)?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        }
        if (!selectedWf) throw new Error("No suitable workflow found");

        // 3. Check for RUNNING Pod
        const pods = await getActivePods(runpodKey);
        const activePod = pods.find((p: any) => 
            (p.desiredStatus?.toUpperCase() === 'RUNNING' || p.lastStatus?.toUpperCase() === 'RUNNING')
        );

        if (!activePod) {
            const podSummary = pods.map((p: any) => `${p.id}(${p.lastStatus})`).join(', ') || 'No pods found';
            throw new Error(`NO_RUNNING_POD: Found [${podSummary}]. Please start a pod.`);
        }

        const podId = activePod.id;
        const comfyUrl = `https://${podId}-80.proxy.runpod.net`;

        // 4. Mark as Processing IMMEDIATELY
        await supabase.from('production_jobs').update({ 
            status: 'Processing', 
            comfyui_pod_id: podId,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);

        // 5. Inject Prompt into Workflow
        const workflowObj = selectedWf.workflow_json;
        const posNodeId = selectedWf.prompt_node_id;
        if (workflowObj[posNodeId]?.inputs) {
            workflowObj[posNodeId].inputs.text = job.prompt_text;
        }

        // Optional: Inject Negative Prompt, Width, Height
        if (selectedWf.negative_prompt_node_id && workflowObj[selectedWf.negative_prompt_node_id]?.inputs) {
            workflowObj[selectedWf.negative_prompt_node_id].inputs.text = selectedWf.base_negative_prompt || '';
        }
        if (selectedWf.width_node_id && workflowObj[selectedWf.width_node_id]?.inputs) {
            workflowObj[selectedWf.width_node_id].inputs.width = item.image_width || 896;
        }
        if (selectedWf.height_node_id && workflowObj[selectedWf.height_node_id]?.inputs) {
            workflowObj[selectedWf.height_node_id].inputs.height = item.image_height || 1152;
        }

        // 6. Submit to ComfyUI
        const submitRes = await fetch(`${comfyUrl}/prompt`, {
            method: 'POST',
            body: JSON.stringify({ prompt: workflowObj })
        });

        if (!submitRes.ok) throw new Error(`ComfyUI Submit Error: ${submitRes.statusText}`);
        const { prompt_id } = await submitRes.json();

        // 7. Link Prompt ID
        await supabase.from('production_jobs').update({ 
            comfyui_prompt_id: prompt_id,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);
        
        console.log(`Job ${job.id} submitted. PromptID: ${prompt_id}`);

    } catch (err: any) {
        console.error(`Job ${job.id} failed:`, err.message);
        await supabase.from('production_jobs').update({ 
            status: 'Failed', 
            error_message: err.message,
            updated_at: new Date().toISOString()
        }).eq('id', job.id);
        
        await logSystem(supabase, 'ERROR', 'Worker: Submit', `Job ${job.id} failed.`, { error: err.message });
    }
}

/**
 * Checks for finished jobs at ComfyUI
 */
async function pollComfyUIJobs(supabase: any) {
    const { data: processingJobs } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('status', 'Processing');

    if (!processingJobs || processingJobs.length === 0) return;

    for (const job of processingJobs) {
        try {
            const comfyUrl = `https://${job.comfyui_pod_id}-80.proxy.runpod.net`;
            const res = await fetch(`${comfyUrl}/history/${job.comfyui_prompt_id}`);
            if (!res.ok) continue;

            const history = await res.json();
            const output = history[job.comfyui_prompt_id];

            if (output) {
                // Job Finished!
                console.log(`Job ${job.id} finished. Handling output...`);
                // [NOTE] In a full rebuild, we'd trigger GCS upload here. 
                // For this 1-3 step, we mark as Completed.
                await supabase.from('production_jobs').update({ 
                    status: 'Completed', 
                    completed_at: new Date().toISOString() 
                }).eq('id', job.id);

                // Self-trigger next refill
                orchestrateQueue(supabase).catch(() => {});
            } else {
                // Check Staleness
                const lastUpdate = new Date(job.updated_at).getTime();
                const now = Date.now();
                if (now - lastUpdate > STALE_THRESHOLD_MINUTES * 60 * 1000) {
                   console.log(`Job ${job.id} stale. Failing.`);
                   await supabase.from('production_jobs').update({ status: 'Failed', error_message: 'Stale handle timeout' }).eq('id', job.id);
                }
            }
        } catch (e) {
            // Ignore individual poll errors
        }
    }
}
