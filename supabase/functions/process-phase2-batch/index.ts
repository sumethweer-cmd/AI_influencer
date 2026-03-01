import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Node built-in polyfills in Edge Runtime
import { Buffer } from "node:buffer";

// Initialize Supabase Client
const supabaseUrl = Deno.env.get('PROJECT_URL') || ''
const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || ''
const runpodApiKey = Deno.env.get('RUNPOD_API_KEY') || ''

const supabase = createClient(supabaseUrl, supabaseKey)

// --- Helper Functions ---

async function logSystem(level: string, context: string, message: string, details?: any) {
    try {
        await supabase.from('system_logs').insert({
            level,
            context,
            message,
            details: details ? JSON.stringify(details) : null,
            created_at: new Date().toISOString()
        })
    } catch (e) {
        console.error('Failed to write system log:', e)
    }
}

async function getActivePods() {
    const query = `
    query Pods {
      myself {
        pods {
          id
          name
          runtime {
            uptimeInSeconds
            ports { ip isIpPublic privatePort publicPort type }
          }
          desiredStatus
          imageName
          machine { podHostId }
        }
      }
    }
  `

    const response = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({ query })
    })
    const json = await response.json()
    return json.data?.myself?.pods || []
}

async function getRunpodConfig(podId: string) {
    const query = `
      query Pod {
        myself {
          pod(id: "${podId}") {
            id
            machine { podHostId }
          }
        }
      }
    `
    const response = await fetch('https://api.runpod.io/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({ query })
    })
    const json = await response.json()
    const pod = json.data?.myself?.pod
    if (!pod || !pod.machine?.podHostId) return null
    return `https://${pod.id}-${pod.machine.podHostId}.proxy.runpod.net`
}

async function getConfig(key: string) {
    const { data } = await supabase.from('global_settings').select('value').eq('key', key).single()
    return data?.value
}

// ComfyUI Queue Logic
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
    return Buffer.from(arrayBuffer)
}

async function uploadToStorage(buffer: Buffer, filename: string, contentType: string = 'image/png'): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;
    const baseDelay = 2000;

    while (attempt < maxRetries) {
        try {
            const { data, error } = await supabase.storage.from('content').upload(filename, buffer, {
                contentType,
                upsert: true
            });

            if (error) {
                console.error(`Supabase upload error (attempt ${attempt + 1}):`, error);
                throw error;
            }

            const { data: { publicUrl } } = supabase.storage.from('content').getPublicUrl(filename);
            return publicUrl;
        } catch (err: any) {
            attempt++;
            if (attempt >= maxRetries) {
                console.error(`Failed to upload ${filename} after ${maxRetries} attempts.`);
                throw err;
            }
            const delay = baseDelay * Math.pow(2, attempt - 1); // 2s, 4s
            console.log(`Retrying upload ${filename} in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Upload failed permanently');
}

async function waitForImagesWithTimeout(comfyUrl: string, promptId: string, timeoutMinutes: number = 10) {
    let history = await getHistory(comfyUrl, promptId)
    const startTime = Date.now()
    const timeoutMs = timeoutMinutes * 60 * 1000

    while (!history || Object.keys(history).length === 0) {
        console.log(`Waiting for ComfyUI Job: ${promptId}`)

        if (Date.now() - startTime > timeoutMs) {
            console.error(`Job ${promptId} timed out after ${timeoutMinutes} minutes.`)
            throw new Error(`ComfyUI Job TimeOut: Exceeded ${timeoutMinutes} minutes. Workflows might be stuck or failed silently.`)
        }

        await new Promise(r => setTimeout(r, 5000))
        try {
            history = await getHistory(comfyUrl, promptId)
        } catch (e) {
            console.warn('Transient error fetching history, continuing to wait...')
        }
    }

    try {
        const outputs = history.outputs
        const fileNames: any[] = []

        if (!outputs || Object.keys(outputs).length === 0) {
            console.error(`Job completed but no outputs found in history for ${promptId}`, history);
            throw new Error('ComfyUI job returned no outputs. Possibly a failed node execution or missing output connections.');
        }

        for (const nodeId in outputs) {
            const nodeOutput = outputs[nodeId]
            if (nodeOutput.images && Array.isArray(nodeOutput.images)) {
                for (const img of nodeOutput.images) {
                    const buf = await getImageBuffer(comfyUrl, img.filename, img.subfolder, img.type)
                    fileNames.push({ filename: img.filename, buffer: buf, contentType: 'image/png' })
                }
            } else if (nodeOutput.gifs && Array.isArray(nodeOutput.gifs)) {
                for (const gif of nodeOutput.gifs) {
                    const buf = await getImageBuffer(comfyUrl, gif.filename, gif.subfolder, gif.type)
                    fileNames.push({ filename: gif.filename, buffer: buf, contentType: 'video/mp4' })
                }
            }
        }

        if (fileNames.length === 0) {
            console.warn(`No recognized images or gifs extracted from outputs for ${promptId}`, outputs);
            throw new Error('Job succeeded, but could not extract image/gif paths from SaveImage node output.');
        }

        return fileNames
    } catch (error) {
        console.error('Error extracting images from history:', error, history);
        throw error;
    }
}


/**
 * Helper to run a single ComfyUI workflow
 */
async function runSingleWorkflow(comfyUrl: string, item: any, type: 'SFW' | 'NSFW', seed: number, persona?: string, poseIndex: number = 0) {
    let selectedWf: any = null

    // 1A. Check for explicit workflow override
    if (item.selected_workflow_id) {
        const { data: explicitWf } = await supabase
            .from('comfyui_workflows')
            .select('*')
            .eq('id', item.selected_workflow_id)
            .single()

        if (explicitWf) {
            selectedWf = explicitWf
        }
    }

    // 1B. Fallback: Fetch matching workflow from DB dynamically
    if (!selectedWf) {
        const { data: workflows, error: wfError } = await supabase
            .from('comfyui_workflows')
            .select('*')

        if (wfError || !workflows || workflows.length === 0) {
            throw new Error(`No workflows found in database. Please upload at least one in Template Studio.`)
        }

        const personaMatches = workflows.filter((w: any) => w.persona === persona)
        const globalMatches = workflows.filter((w: any) => !w.persona)

        if (personaMatches.length > 0) {
            selectedWf = personaMatches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        } else if (globalMatches.length > 0) {
            selectedWf = globalMatches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        } else {
            selectedWf = workflows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        }
    }

    const workflowObj = selectedWf.workflow_json as any
    const posNodeId = selectedWf.prompt_node_id
    const negNodeId = selectedWf.negative_prompt_node_id

    // 2. Inject Positive Prompt (Decoupled Architecture)
    let personaTrigger = ''
    let personaInstruction = ''
    if (persona) {
        const { data: personaData } = await supabase.from('ai_personas').select('trigger_word, instruction_rule').eq('name', persona).single()
        if (personaData) {
            personaTrigger = personaData.trigger_word || ''
            personaInstruction = personaData.instruction_rule || ''
        }
    }

    const struct = item.prompt_structure || {}
    const pose = (struct.poses && struct.poses.length > poseIndex) ? struct.poses[poseIndex] : ''
    const camera = (struct.camera_settings && struct.camera_settings.length > poseIndex) ? struct.camera_settings[poseIndex] : ''
    const nsfwPrompt = (struct.nsfw_prompts && struct.nsfw_prompts.length > poseIndex) ? struct.nsfw_prompts[poseIndex] : ''

    const hasFixedElements = struct.mood_and_tone || struct.vibe || struct.lighting || struct.outfit

    let baseDescription = item.sfw_prompt
    if (hasFixedElements) {
        baseDescription = [
            struct.mood_and_tone,
            struct.vibe,
            struct.lighting,
            struct.outfit
        ].filter(p => p && String(p).trim() !== '').join(', ')
    }

    const parts = [
        personaTrigger,
        struct.mood_and_tone,
        struct.vibe,
        struct.lighting,
        struct.outfit,
        camera,
        pose
    ]
    if (type === 'NSFW' && nsfwPrompt) parts.push(nsfwPrompt)

    const dynamicPrompt = Array.from(new Set(parts.filter(p => p && String(p).trim() !== ''))).join(', ')

    const basePos = selectedWf.base_positive_prompt ? `${selectedWf.base_positive_prompt}, ` : ''
    const finalPrompt = `${basePos}${dynamicPrompt}`

    if (workflowObj[posNodeId] && workflowObj[posNodeId].inputs) {
        workflowObj[posNodeId].inputs.text = finalPrompt
    } else {
        throw new Error(`Invalid Positive Prompt Node ID: ${posNodeId} in Workflow: ${selectedWf.name}`)
    }

    // 2.5 Inject Negative Prompt
    if (negNodeId && workflowObj[negNodeId] && workflowObj[negNodeId].inputs) {
        workflowObj[negNodeId].inputs.text = selectedWf.base_negative_prompt || ''
    }

    // 3. Optional Settings (Dimensions, Batch Size) from Mapped Nodes
    const globalWidth = await getConfig('PRODUCTION_WIDTH')
    const globalHeight = await getConfig('PRODUCTION_HEIGHT')

    if (selectedWf.batch_size_node_id && workflowObj[selectedWf.batch_size_node_id]?.inputs) {
        workflowObj[selectedWf.batch_size_node_id].inputs.batch_size = 1 // Force 1 because we are looping poses
    }

    if (selectedWf.width_node_id && workflowObj[selectedWf.width_node_id]?.inputs) {
        workflowObj[selectedWf.width_node_id].inputs.width = globalWidth ? parseInt(globalWidth) : (item.image_width || 896)
    }

    if (selectedWf.height_node_id && workflowObj[selectedWf.height_node_id]?.inputs) {
        workflowObj[selectedWf.height_node_id].inputs.height = globalHeight ? parseInt(globalHeight) : (item.image_height || 1152)
    }

    // 4. Inject Seed to Seed-capable nodes
    for (const key in workflowObj) {
        if (workflowObj[key].class_type === 'KSampler' && workflowObj[key].inputs) {
            if ('seed' in workflowObj[key].inputs) workflowObj[key].inputs.seed = seed
            if ('noise_seed' in workflowObj[key].inputs) workflowObj[key].inputs.noise_seed = seed
        }
    }

    // 4. Send to ComfyUI
    const { prompt_id } = await queuePrompt(comfyUrl, workflowObj)
    const images = await waitForImagesWithTimeout(comfyUrl, prompt_id)

    const downloadedFiles = []

    for (let i = 0; i < images.length; i++) {
        const imgItem = images[i]
        const storageFilename = `${item.id}_${type}_${Date.now()}_${i}.png`
        const storageBucketPath = `images/${item.id}/${type}/${storageFilename}`

        const publicUrl = await uploadToStorage(imgItem.buffer, storageBucketPath, imgItem.contentType)
        downloadedFiles.push({ filename: storageFilename, url: publicUrl })
    }

    const vdoPrompts = type === 'NSFW' ? struct.vdo_prompts_nsfw : struct.vdo_prompts
    const vdoPromptUsed = (vdoPrompts && vdoPrompts.length > poseIndex) ? vdoPrompts[poseIndex] : ''

    return { fileNames: downloadedFiles, workflowSnapshot: workflowObj, vdoPrompt: vdoPromptUsed }
}

async function recordGeneratedImage(contentId: string, type: 'SFW' | 'NSFW', fileName: string, fileUrl: string, seed: number, podId: string, workflow: any, vdoPrompt?: string, slotIndex?: number) {
    await supabase.from('generated_images').insert({
        content_item_id: contentId,
        image_type: type,
        file_path: fileUrl,
        file_name: fileName,
        seed,
        workflow_json: workflow,
        runpod_job_id: podId,
        vdo_prompt: vdoPrompt || '',
        vdo_status: vdoPrompt ? 'pending' : 'none',
        slot_index: slotIndex,
        status: 'Generated'
    })
}

// --- Background Processor Loop ---

async function processItemAsync(item: any, specificIndex?: number, forceType?: 'SFW' | 'NSFW') {
    try {
        await logSystem('INFO', 'Edge Function: Production', `Processing Item #${item.sequence_number}: ${item.topic}`)

        // 1. Check Pods
        const activePods = await getActivePods()
        const runningPod = activePods.find((p: any) => p.desiredStatus === 'RUNNING')

        if (!runningPod) {
            throw new Error('NO_ACTIVE_POD: Please start a Runpod instance from the Control Center first.')
        }

        const podId = runningPod.id
        const comfyUrl = await getRunpodConfig(podId)
        if (!comfyUrl) throw new Error("Could not construct ComfyUI URL")

        await logSystem('INFO', 'Edge Function: Production', `ComfyUI connected at ${comfyUrl}`)

        const globalBatchSizeStr = await getConfig('PRODUCTION_BATCH_SIZE')
        const totalExpected = globalBatchSizeStr ? parseInt(globalBatchSizeStr) : (item.batch_size || 4)

        // SFW Generation Loop
        if (item.gen_sfw && (forceType === 'SFW' || !forceType)) {
            for (let poseIdx = 0; poseIdx < totalExpected; poseIdx++) {
                if (specificIndex !== undefined && poseIdx !== specificIndex) continue

                // Verify DB for existing images to avoid re-generating
                const { data: existingImgs } = await supabase.from('generated_images')
                    .select('id').eq('content_item_id', item.id).eq('image_type', 'SFW').eq('slot_index', poseIdx)

                if (!forceType && existingImgs && existingImgs.length > 0) continue

                const loopSeed = Math.floor(Math.random() * 1000000000)
                const sfwRes = await runSingleWorkflow(comfyUrl, item, 'SFW', loopSeed, item.persona, poseIdx)
                for (const fileObj of sfwRes.fileNames) {
                    await recordGeneratedImage(item.id, 'SFW', fileObj.filename, fileObj.url, loopSeed, podId, sfwRes.workflowSnapshot, sfwRes.vdoPrompt, poseIdx)
                }
            }
        }

        // NSFW Generation Loop
        if (item.gen_nsfw && (forceType === 'NSFW' || !forceType)) {
            for (let poseIdx = 0; poseIdx < totalExpected; poseIdx++) {
                if (specificIndex !== undefined && poseIdx !== specificIndex) continue

                // Verify DB for existing images to avoid re-generating
                const { data: existingImgs } = await supabase.from('generated_images')
                    .select('id').eq('content_item_id', item.id).eq('image_type', 'NSFW').eq('slot_index', poseIdx)

                if (!forceType && existingImgs && existingImgs.length > 0) continue

                const loopSeed = Math.floor(Math.random() * 1000000000)
                const nsfwRes = await runSingleWorkflow(comfyUrl, item, 'NSFW', loopSeed, item.persona, poseIdx)
                for (const fileObj of nsfwRes.fileNames) {
                    await recordGeneratedImage(item.id, 'NSFW', fileObj.filename, fileObj.url, loopSeed, podId, nsfwRes.workflowSnapshot, nsfwRes.vdoPrompt, poseIdx)
                }
            }
        }

        // Mark as QC Pending since it succeeded
        await supabase.from('content_items').update({ status: 'QC Pending' }).eq('id', item.id)
        await logSystem('SUCCESS', 'Edge Function: Production', `Item #${item.sequence_number} (${item.topic}) completed successfully.`)

        // Check if there are more queued items!
        const { data: nextItem } = await supabase.from('content_items')
            .select('*')
            .eq('status', 'Queued for Production') // New intermediate status
            .order('sequence_number', { ascending: true })
            .limit(1)
            .single()

        if (nextItem) {
             // By updating it to 'In Production', the Webhook will trigger this Edge Function again!
             await supabase.from('content_items').update({ status: 'In Production' }).eq('id', nextItem.id)
        }

    } catch (err: any) {
        console.error(`Item ${item.id} processing failed:`, err)
        await logSystem('ERROR', 'Edge Function: Production', `Item #${item.sequence_number} failed. Reverting to Draft.`, { error: err.message })
        // Mark failed item as Draft
        await supabase.from('content_items').update({ status: 'Draft' }).eq('id', item.id)

        // Even if this item fails, we should still try to pick up the next 'Queued' item!
        const { data: nextItem } = await supabase.from('content_items')
            .select('*')
            .eq('status', 'Queued for Production')
            .order('sequence_number', { ascending: true })
            .limit(1)
            .single()

        if (nextItem) {
             await supabase.from('content_items').update({ status: 'In Production' }).eq('id', nextItem.id)
        }
    }
}

// --- Edge Server Handler ---

serve(async (req) => {
    try {
        const payload = await req.json()
        console.log("Webhook/Direct Payload Received:", payload)

        // 1. Triggered via Webhook (from "Queued" -> "In Production")
        if (payload.type === 'UPDATE' && payload.table === 'content_items') {
            const item = payload.record
            const oldStatus = payload.old_record?.status

            // Ensure we ONLY hook into the precise transition
            if (item.status === 'In Production' && oldStatus === 'Queued for Production') {
                console.log(`Webhook Trigger processing for Item ID: ${item.id}`)

                // Process Asynchronously, immediate 200 return
                processItemAsync(item).catch(e => console.error("Async Processing Error:", e))

                return new Response(JSON.stringify({ success: true, message: 'Processing started contextually' }), {
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            return new Response(JSON.stringify({ message: "Ignored Webhook Event" }), { status: 200 })
        }

        // 2. Direct Manual Invocation (e.g. from /api/jobs/generate-single)
        if (payload.contentIds && Array.isArray(payload.contentIds) && payload.contentIds.length > 0) {
            console.log("Direct Invocation via HTTP POST");
            const itemId = payload.contentIds[0]
            const { specificIndex, forceType } = payload

            const { data } = await supabase.from('content_items').select('*').eq('id', itemId).single()
            if (data) {
                // Ensure UI updated it to 'In Production' beforehand
                processItemAsync(data, specificIndex, forceType).catch(e => console.error("Async Error:", e))
                return new Response(JSON.stringify({ success: true, message: 'Manual processing started' }), { headers: { 'Content-Type': 'application/json' } })
            }
            return new Response(JSON.stringify({ error: "Item not found" }), { status: 404 })
        }

        return new Response(JSON.stringify({ message: "Invalid payload format" }), { status: 400 })
    } catch (err: any) {
        console.error("Edge Function Main Error:", err)
        return new Response(JSON.stringify({ error: err.message }), { status: 500 })
    }
})
