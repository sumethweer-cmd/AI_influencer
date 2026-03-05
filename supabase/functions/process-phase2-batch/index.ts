import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const PROJECT_URL = Deno.env.get('PROJECT_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')
const runpodApiKey = Deno.env.get('RUNPOD_API_KEY')

const supabase = createClient(PROJECT_URL!, SERVICE_ROLE_KEY!)

// --- Helpers ---

async function logSystem(level: 'INFO' | 'ERROR' | 'SUCCESS' | 'WARN', phase: string, message: string, metadata: any = null) {
    console.log(`[${level}] ${phase}: ${message}`, metadata ? JSON.stringify(metadata) : '');
    await supabase.from('system_logs').insert({
        level,
        phase,
        message,
        metadata
    })
}

async function getActivePods() {
    const query = `{ myself { pods { id desiredStatus } } }`
    const response = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${runpodApiKey}` },
        body: JSON.stringify({ query })
    })
    const json = await response.json()
    return json.data?.myself?.pods || []
}

async function queuePrompt(comfyUrl: string, prompt: any) {
    const res = await fetch(`${comfyUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    })
    return await res.json()
}

async function getHistory(comfyUrl: string, promptId: string) {
    const res = await fetch(`${comfyUrl}/history/${promptId}`)
    const json = await res.json()
    return json[promptId]
}

async function getImageBuffer(comfyUrl: string, filename: string, subfolder: string, folder_type: string) {
    const params = new URLSearchParams({ filename, subfolder, type: folder_type })
    const res = await fetch(`${comfyUrl}/view?${params.toString()}`)
    const arrayBuffer = await res.arrayBuffer()
    return new Uint8Array(arrayBuffer)
}

async function uploadToStorage(buffer: Uint8Array, filename: string, contentType: string = 'image/png'): Promise<string> {
    const { data, error } = await supabase.storage.from('content').upload(filename, buffer, {
        contentType,
        upsert: true
    });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('content').getPublicUrl(filename);
    return publicUrl;
}

async function checkHistoryOnce(comfyUrl: string, promptId: string, outputNodeId?: string) {
    let history = null
    try {
        history = await getHistory(comfyUrl, promptId)
    } catch (e) { return null; }

    if (!history || !history.outputs) return null; // Not finished yet

    const outputs = history.outputs
    const results: any[] = []

    // If outputNodeId is specified, prioritize it!
    if (outputNodeId && outputs[outputNodeId]?.images) {
        for (const img of outputs[outputNodeId].images) {
            const buf = await getImageBuffer(comfyUrl, img.filename, img.subfolder, img.type)
            results.push({ filename: img.filename, buffer: buf, contentType: 'image/png' })
        }
    } else {
        // Fallback: Loop through all nodes
        for (const nodeId in outputs) {
            const out = outputs[nodeId]
            if (out.images) {
                for (const img of out.images) {
                    const buf = await getImageBuffer(comfyUrl, img.filename, img.subfolder, img.type)
                    results.push({ filename: img.filename, buffer: buf, contentType: 'image/png' })
                }
            } else if (out.gifs) {
                for (const gif of out.gifs) {
                    const buf = await getImageBuffer(comfyUrl, gif.filename, gif.subfolder, gif.type)
                    results.push({ filename: gif.filename, buffer: buf, contentType: 'video/mp4' })
                }
            }
        }
    }

    if (results.length === 0) throw new Error("No images found in history outputs.");
    return results
}

// --- WORKER LOGIC ---

async function submitJobToComfyUI(jobId: string, isMock: boolean = false, mockDelay: number = 2000) {
    let job = null
    try {
        // 1. Fetch Job and Lock
        const { data: jobData } = await supabase.from('production_jobs').select('*').eq('id', jobId).single()
        if (!jobData || jobData.status !== 'Queued') return;
        job = jobData

        await supabase.from('production_jobs').update({ status: 'Processing', updated_at: new Date().toISOString() }).eq('id', jobId)
        await logSystem('INFO', 'Production Worker', `Submitting Job: ${jobId} (Slot ${job.slot_index}, ${job.image_type}) ${isMock ? '[MOCK MODE]' : ''}`)

        // 2. Fetch Parent Item and Workflow
        const { data: item } = await supabase.from('content_items').select('*').eq('id', job.content_item_id).single()
        if (!item) throw new Error("Parent content item not found.");

        let selectedWf: any = null;
        if (item.selected_workflow_id) {
            const { data } = await supabase.from('comfyui_workflows').select('*').eq('id', item.selected_workflow_id).single()
            selectedWf = data
        }

        if (!selectedWf && item.persona) {
            const { data: personaData } = await supabase.from('ai_personas').select('default_workflow_id').eq('name', item.persona).single()
            if (personaData && personaData.default_workflow_id) {
                const { data } = await supabase.from('comfyui_workflows').select('*').eq('id', personaData.default_workflow_id).single()
                selectedWf = data
            }
        }

        if (!selectedWf) {
            const { data: workflows } = await supabase.from('comfyui_workflows').select('*')
            const matches = workflows?.filter((w: any) => w.persona === item.persona)
            selectedWf = (matches?.length ? matches : workflows!)?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        }
        if (!selectedWf) throw new Error("No workflow found.");

        const workflowObj = JSON.parse(JSON.stringify(selectedWf.workflow_json))
        const posNodeId = selectedWf.prompt_node_id

        // 3. Prepare ComfyUI Workflow
        
        // --- KEYWORD INJECTION ---
        let finalPrompt = job.prompt_text || ''
        if (job.image_type === 'SFW' && !finalPrompt.toUpperCase().includes('SFW')) {
            finalPrompt += ', SFW'
        } else if (job.image_type === 'NSFW' && !finalPrompt.toUpperCase().includes('NSFW')) {
            finalPrompt += ', NSFW'
        }

        if (workflowObj[posNodeId]?.inputs) {
            workflowObj[posNodeId].inputs.text = finalPrompt
        }
        
        const widthNode = selectedWf.width_node_id
        const heightNode = selectedWf.height_node_id
        if (widthNode && workflowObj[widthNode]?.inputs) workflowObj[widthNode].inputs.width = item.image_width || 896
        if (heightNode && workflowObj[heightNode]?.inputs) workflowObj[heightNode].inputs.height = item.image_height || 1152

        // --- SEED INJECTION ---
        // Generate a large random integer for true uniqueness per ComfyUI request
        const seed = Math.floor(Math.random() * 100000000000000)
        for (const key in workflowObj) {
            if (workflowObj[key].class_type === 'KSampler' && workflowObj[key].inputs) {
                workflowObj[key].inputs.seed = seed
                workflowObj[key].inputs.noise_seed = seed
            }
        }


        if (isMock) {
            // In mock mode, we jump straight to Polling loop by faking a prompt_id
            await supabase.from('production_jobs').update({
                comfyui_prompt_id: 'MOCK_' + jobId,
                comfyui_pod_id: 'MOCK_POD'
            }).eq('id', jobId)
            await logSystem('INFO', 'Production Worker', `[MOCK MODE] Job ${jobId} registered for polling.`)
        } else {
            // 4. Runpod Connectivity
            const activePods = await getActivePods()
            const runningPod = activePods.find((p: any) => p.desiredStatus === 'RUNNING')
            if (!runningPod) throw new Error('NO_RUNNING_POD');
            
            const comfyUrl = `https://${runningPod.id}-8188.proxy.runpod.net`
            const { prompt_id } = await queuePrompt(comfyUrl, workflowObj)

            // 5. Update Job with Prompt ID so the Poller can pick it up
            await supabase.from('production_jobs').update({
                comfyui_prompt_id: prompt_id,
                comfyui_pod_id: runningPod.id
            }).eq('id', jobId)
            
            await logSystem('INFO', 'Production Worker', `Job ${jobId} submitted to ComfyUI (${prompt_id})`)
            
            // 6. CHAINING: Ensure queue stays full (Max 4 Concurrency)
            const { count: currentProcessing } = await supabase.from('production_jobs')
                .select('*', { count: 'exact', head: true })
                .in('status', ['Processing', 'Queued'])

            const availableSlots = Math.max(0, 4 - (currentProcessing || 0));

            if (availableSlots > 0) {
                const { data: pendingJobs } = await supabase.from('production_jobs')
                    .select('*')
                    .eq('status', 'Pending')
                    .order('created_at', { ascending: true })
                    .limit(availableSlots)

                if (pendingJobs && pendingJobs.length > 0) {
                    const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/process-phase2-batch'
                    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
                    
                    for (const nextJob of pendingJobs) {
                        await supabase.from('production_jobs').update({ status: 'Queued' }).eq('id', nextJob.id)
                        const updatedNextJob = { ...nextJob, status: 'Queued' }
                        fetch(selfUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
                            body: JSON.stringify({ record: updatedNextJob, mock: isMock, mock_delay: mockDelay })
                        }).catch(e => console.error('Self-chain call failed:', e))
                        await logSystem('INFO', 'Production Worker', `Concurrency refill: Chained to submit job ${nextJob.id} (Slot ${nextJob.slot_index})`)
                    }
                }
            }
        }

    } catch (err: any) {
        console.error("Worker Error:", err)
        if (job) {
            await supabase.from('production_jobs').update({ status: 'Failed', error_message: err.message, updated_at: new Date().toISOString() }).eq('id', job.id)
            await logSystem('ERROR', 'Production Worker', `Job ${job.id} failed: ${err.message}`)
        }
    }
}

async function pollComfyUIJobs(isMock: boolean = false, mockDelay: number = 2000) {
    let completedCount = 0;

    // 1. EXTRA SAFETY: Ensure Queue is at Max Concurrency (4) BEFORE doing anything else
    const { count: currentProcessing } = await supabase.from('production_jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Processing', 'Queued'])

    const availableSlots = Math.max(0, 4 - (currentProcessing || 0));

    if (availableSlots > 0) {
        const { data: pendingJobs } = await supabase.from('production_jobs')
            .select('*')
            .eq('status', 'Pending')
            .order('created_at', { ascending: true })
            .limit(availableSlots)

        if (pendingJobs && pendingJobs.length > 0) {
            const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/process-phase2-batch'
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
            for (const pJob of pendingJobs) {
                 // **CRITICAL FIX**: Change status to 'Queued' to trigger the webhook and the submit logic!
                 await supabase.from('production_jobs').update({ status: 'Queued' }).eq('id', pJob.id)
                 const nextJobToPush = { ...pJob, status: 'Queued' }
                 fetch(selfUrl, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
                     body: JSON.stringify({ record: nextJobToPush, mock: isMock, mock_delay: mockDelay })
                 }).catch(e => console.error('Safety Queued Push failed:', e))
                 await logSystem('INFO', 'Production Worker', `Safety Poller pushed Pending job ${pJob.id}`)
            }
        }
    }
    
    // 2. Safety for stuck Queued jobs (jobs that were updating to Queued but webhook dropped)
    const { data: stuckQueuedJobs } = await supabase.from('production_jobs')
        .select('*')
        .eq('status', 'Queued')

    if (stuckQueuedJobs && stuckQueuedJobs.length > 0) {
        const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/process-phase2-batch'
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        for (const qJob of stuckQueuedJobs) {
             fetch(selfUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
                 body: JSON.stringify({ record: qJob, mock: isMock, mock_delay: mockDelay })
             }).catch(e => console.error('Safety Queued Retry failed:', e))
        }
    }

    // 3. ACTUAL POLLING: Check for completed Processing jobs
    const { data: processingJobs } = await supabase.from('production_jobs')
        .select('*')
        .eq('status', 'Processing')
        .not('comfyui_prompt_id', 'is', null)

    if (!processingJobs || processingJobs.length === 0) return completedCount;

    for (const job of processingJobs) {
        try {
            let images: any[] | undefined = undefined;
            let workflowObj: any = {};
            let seed = 0;

            const { data: item } = await supabase.from('content_items').select('*').eq('id', job.content_item_id).single()
            if (!item) continue;
            
            let selectedWf: any = null;
            if (item.selected_workflow_id) {
                 const { data } = await supabase.from('comfyui_workflows').select('*').eq('id', item.selected_workflow_id).single()
                 selectedWf = data
            } else {
                 const { data: workflows } = await supabase.from('comfyui_workflows').select('*')
                 const matches = workflows?.filter((w: any) => w.persona === item.persona)
                 selectedWf = (matches?.length ? matches : workflows!)?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            }

            if (isMock && job.comfyui_prompt_id?.startsWith('MOCK_')) {
                // Determine if it should be finished yet based on updated_at
                const elapsed = Date.now() - new Date(job.updated_at).getTime();
                if (elapsed >= mockDelay) {
                    const placeholder = new Uint8Array([
                        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
                        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
                        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
                        0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0x44, 0x74, 0x06, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
                        0x44, 0xae, 0x42, 0x60, 0x82
                    ])
                    images = [{ filename: 'mock.png', buffer: placeholder, contentType: 'image/png' }]
                }
            } else {
                const comfyUrl = `https://${job.comfyui_pod_id}-8188.proxy.runpod.net`
                let outputNodeId = selectedWf?.output_node_id;
                images = await checkHistoryOnce(comfyUrl, job.comfyui_prompt_id, outputNodeId);
            }

            // Not done yet!
            if (!images) continue;

            // Done! Record Results
            for (let i = 0; i < images.length; i++) {
                const img = images[i]
                const storagePath = `images/${item.id}/${job.image_type}/${job.id}_${i}.${img.contentType === 'video/mp4' ? 'mp4' : 'png'}`
                const publicUrl = await uploadToStorage(img.buffer, storagePath, img.contentType)

                await supabase.from('generated_images').upsert({
                    content_item_id: item.id,
                    image_type: job.image_type,
                    file_path: publicUrl,
                    file_name: storagePath,
                    seed,
                    workflow_json: workflowObj,
                    runpod_job_id: job.comfyui_pod_id,
                    slot_index: job.slot_index,
                    status: 'Generated'
                }, { onConflict: 'content_item_id,slot_index,image_type' })
            }

            await supabase.from('production_jobs').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', job.id)
            await logSystem('SUCCESS', 'Production Worker', `Job ${job.id} completed. Images downloaded.`)
            completedCount++;

            // UPDATE PARENT STATUS if item is fully done
            const { count: remainingJobs } = await supabase.from('production_jobs')
                .select('*', { count: 'exact', head: true })
                .eq('content_item_id', job.content_item_id)
                .in('status', ['Pending', 'Queued', 'Processing'])

            if (remainingJobs === 0) {
                await supabase.from('content_items').update({ status: 'QC Pending' }).eq('id', job.content_item_id)
                await logSystem('SUCCESS', 'Production Worker', `Content Item (${item.topic}) is 100% complete → QC Pending`)
            }

        } catch (err: any) {
            console.error("Poller Error for Job", job.id, ":", err)
            // if we hit an error (like NO_IMAGES_FOUND), we can fail the job
            if (err.message?.includes('No images found')) {
                await supabase.from('production_jobs').update({ status: 'Failed', error_message: err.message, updated_at: new Date().toISOString() }).eq('id', job.id)
                await logSystem('ERROR', 'Production Worker', `Job ${job.id} failed during polling: ${err.message}`)
            }
        }
    }

    // --- AUTO TERMINATE RUNPOD CHECK ---
    const { count: anyActiveJobs } = await supabase.from('production_jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Pending', 'Queued', 'Processing'])
    
    if (anyActiveJobs === 0) {
        const { data: config } = await supabase.from('system_configs').select('key_value').eq('key_name', 'AUTO_TERMINATE_RUNPOD').maybeSingle()
        if (config?.key_value === 'true') {
            const activePods = await getActivePods()
            const runningPod = activePods.find((p: any) => p.desiredStatus === 'RUNNING')
            if (runningPod) {
                try {
                    await fetch(`https://api.runpod.io/graphql?api_key=${Deno.env.get('RUNPOD_API_KEY')}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: `mutation { podStop(input: {podId: "${runningPod.id}"}) { id desiredStatus } }`
                        })
                    })
                    // Reset config to false so we don't spam API
                    await supabase.from('system_configs').upsert({ key_name: 'AUTO_TERMINATE_RUNPOD', key_value: 'false' })
                    await logSystem('SUCCESS', 'Production Worker', `Auto-terminated Runpod ${runningPod.id} because the queue is empty.`)
                } catch (e: any) {
                    await logSystem('ERROR', 'Production Worker', `Failed to auto-terminate Runpod: ${e.message}`)
                }
            }
        }
    }

    return completedCount;
}

// --- HANDLER ---

// --- WATCHDOG: Find stuck Processing and Queued jobs ---
async function runWatchdog(isMock: boolean, mockDelay: number) {
    const STUCK_PROCESSING_MINUTES = 8
    const STUCK_QUEUED_MINUTES = 3  // Queued should trigger Edge Function fast, if stuck > 3min = problem

    const sinceLong = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString()
    const sinceShort = new Date(Date.now() - STUCK_QUEUED_MINUTES * 60 * 1000).toISOString()

    // --- Part 1: Fix stuck Processing jobs (retry) ---
    const { data: stuckProcessing, error } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('status', 'Processing')
        .lt('updated_at', sinceLong)

    if (error) {
        await logSystem('ERROR', 'Watchdog', `Failed to fetch stuck jobs: ${error.message}`)
        return { checked: 0, retried: 0, failedQueued: 0 }
    }

    let retried = 0
    for (const stuckJob of (stuckProcessing || [])) {
        await logSystem('WARN', 'Watchdog', `Job ${stuckJob.id} stuck in Processing for > ${STUCK_PROCESSING_MINUTES}min — retrying`)
        await supabase.from('production_jobs').update({ status: 'Queued', error_message: null, updated_at: new Date().toISOString() }).eq('id', stuckJob.id)
        const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/process-phase2-batch'
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const retriedJob = { ...stuckJob, status: 'Queued' }
        fetch(selfUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({ record: retriedJob, mock: isMock, mock_delay: mockDelay })
        }).catch(e => console.error('Watchdog retry call failed:', e))
        retried++
    }

    // --- Part 2: Fix stuck Queued jobs (Edge Function was never triggered or failed silently) ---
    const { data: stuckQueued } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('status', 'Queued')
        .lt('updated_at', sinceShort)

    let failedQueued = 0
    if (stuckQueued && stuckQueued.length > 0) {
        // Check if Runpod is running, if not - fail all stuck Queued jobs
        let hasRunningPod = false
        try {
            const activePods = await getActivePods()
            hasRunningPod = activePods.some((p: any) => p.desiredStatus === 'RUNNING')
        } catch (e) { hasRunningPod = false }

        for (const qJob of stuckQueued) {
            if (!hasRunningPod) {
                // No pod running = certain fail, mark Failed immediately
                await supabase.from('production_jobs').update({ 
                    status: 'Failed', 
                    error_message: 'NO_RUNNING_POD: Job was stuck in Queued and Runpod is not active.', 
                    updated_at: new Date().toISOString() 
                }).eq('id', qJob.id)
                await logSystem('WARN', 'Watchdog', `Job ${qJob.id} stuck in Queued > ${STUCK_QUEUED_MINUTES}min and no Runpod running → marked Failed`)
                failedQueued++
            } else {
                // Pod is running but Edge Function wasn't triggered - retry
                await logSystem('WARN', 'Watchdog', `Job ${qJob.id} stuck in Queued > ${STUCK_QUEUED_MINUTES}min but Runpod is running → retrying`)
                const selfUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/process-phase2-batch'
                const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
                fetch(selfUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
                    body: JSON.stringify({ record: qJob, mock: isMock, mock_delay: mockDelay })
                }).catch(e => console.error('Watchdog Queued retry failed:', e))
                retried++
            }
        }
    }

    await logSystem('INFO', 'Watchdog', `Checked ${(stuckProcessing?.length || 0) + (stuckQueued?.length || 0)} stuck jobs, retried ${retried}, failed ${failedQueued}`)
    return { checked: stuckProcessing?.length || 0, retried, failedQueued }
}

serve(async (req: Request) => {
    try {
        const payload = await req.json()
        const isMock = payload.mock === true
        const mockDelay = parseInt(payload.mock_delay) || 40000

        // WATCHDOG route: { action: 'watchdog' }
        if (payload.action === 'watchdog') {
            const result = await runWatchdog(isMock, mockDelay)
            return new Response(JSON.stringify({ success: true, watchdog: result }), { headers: { 'Content-Type': 'application/json' } })
        }

        // POLLING route: { action: 'poll_comfyui' }
        if (payload.action === 'poll_comfyui') {
            const count = await pollComfyUIJobs(isMock, mockDelay)
            return new Response(JSON.stringify({ success: true, completedCount: count }), { headers: { 'Content-Type': 'application/json' } })
        }

        const job = payload.record || payload.job

        if (job && job.status === 'Queued') {
            submitJobToComfyUI(job.id, isMock, mockDelay).catch(e => console.error("Async Submit Error:", e))
            return new Response(JSON.stringify({ success: true, mock: isMock, message: 'Submitted asynchronously' }), { headers: { 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ message: 'Ignored', reason: !job ? 'No job' : `Status not Queued (was: ${job?.status})` }), { status: 200 })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
