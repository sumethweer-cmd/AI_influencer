import { deployPod, terminatePod, waitForComfyUI } from '@/lib/runpod'
import { ComfyUIClient } from '@/lib/comfyui'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'
import { ContentItem } from '@/types'
import path from 'path'

/**
 * Main Job: The Automated Production
 * Takes Draft items, runs them in ComfyUI, and downloads results.
 */
export async function runProductionBatch() {
    const PHASE = 'Phase2: Production'
    let podId: string | null = null
    let dbJobId: string | null = null

    try {
        await logSystem('INFO', PHASE, 'Starting Production Batch...')

        // 1. Fetch items with status 'In Production'
        const { data: items, error: fetchError } = await supabaseAdmin
            .from('content_items')
            .filter('status', 'eq', 'In Production')
            .order('sequence_number', { ascending: true })

        if (fetchError) throw fetchError
        if (!items || items.length === 0) {
            await logSystem('INFO', PHASE, 'No items in Production queue.')
            return { success: true, message: 'No items' }
        }

        await sendNotification(`⚙️ <b>Phase 2:</b> Processing ${items.length} content items...`)

        // Init Monitoring Job
        const { data: job } = await supabaseAdmin.from('production_jobs').insert({
            status: 'Deploying Pod',
            total_items: items.length
        }).select('id').single()
        if (job) dbJobId = job.id

        // 2. Deploy Runpod
        podId = await deployPod(`nong-kung-prod-${Date.now()}`)
        await logSystem('INFO', PHASE, 'Pod deployed. Waiting for ComfyUI to be ready...', { podId })
        if (dbJobId) await supabaseAdmin.from('production_jobs').update({ status: 'Waiting for ComfyUI', runpod_job_id: podId }).eq('id', dbJobId)

        // 3. Wait for ComfyUI Service
        const comfyUrl = await waitForComfyUI(podId)

        // Extract host and port from URL
        const urlObj = new URL(comfyUrl)
        const host = urlObj.hostname
        const port = parseInt(urlObj.port || '8188')

        const comfy = new ComfyUIClient(host, port)
        await logSystem('INFO', PHASE, `ComfyUI is ready at ${comfyUrl}. Starting generation loop...`)

        let iterCount = 0

        // 5. Process each item
        for (const item of items as ContentItem[]) {
            if (dbJobId) await supabaseAdmin.from('production_jobs').update({ status: 'Generating', current_item_id: item.id, completed_items: iterCount }).eq('id', dbJobId)

            await logSystem('INFO', PHASE, `Processing Item #${item.sequence_number}: ${item.topic}`)

            // Update status to 'In Production'
            await supabaseAdmin.from('content_items').update({ status: 'In Production' }).eq('id', item.id)

            const seed = Math.floor(Math.random() * 1000000000)

            // RUN SFW WORKFLOW
            try {
                const sfwRes = await runSingleWorkflow(comfy, item, 'SFW', seed, item.persona)
                await recordGeneratedImage(item.id, 'SFW', sfwRes.fileName, seed, podId, sfwRes.workflowSnapshot)
            } catch (err: any) {
                await logSystem('WARNING', PHASE, `SFW Workflow skipped for item ${item.sequence_number}`, { error: err.message })
            }

            // IF NSFW REQUIRED → RUN NSFW WORKFLOW WITH SAME SEED
            if (item.nsfw_option) {
                try {
                    const nsfwRes = await runSingleWorkflow(comfy, item, 'NSFW', seed, item.persona)
                    await recordGeneratedImage(item.id, 'NSFW', nsfwRes.fileName, seed, podId, nsfwRes.workflowSnapshot)
                } catch (err: any) {
                    await logSystem('WARNING', PHASE, `NSFW Workflow skipped for item ${item.sequence_number}`, { error: err.message })
                }
            }

            // Update status to 'QC Pending'
            await supabaseAdmin.from('content_items').update({ status: 'QC Pending' }).eq('id', item.id)
            iterCount++
        }

        if (dbJobId) await supabaseAdmin.from('production_jobs').update({ status: 'Completed', completed_items: items.length, completed_at: new Date().toISOString() }).eq('id', dbJobId)

        await logSystem('SUCCESS', PHASE, 'Batch production completed.')
        await sendNotification(`✨ <b>Phase 2 Complete:</b> Produced images for ${items.length} items. Moving to QC...`)

        return { success: true }
    } catch (error: any) {
        if (dbJobId) await supabaseAdmin.from('production_jobs').update({ status: 'Failed', error_message: error.message, completed_at: new Date().toISOString() }).eq('id', dbJobId)
        await logSystem('ERROR', PHASE, 'Batch failed', { error: error.message })
        await sendNotification(`❌ <b>Phase 2 Error:</b> ${error.message}`)
        return { success: false, error: error.message }
    } finally {
        // ALWAYS terminate pod to save $
        if (podId) {
            if (dbJobId) await supabaseAdmin.from('production_jobs').update({ status: 'Terminating Pod' }).eq('id', dbJobId)
            await terminatePod(podId)
            await logSystem('INFO', PHASE, 'Runpod terminated successfully.')
        }
    }
}

/**
 * Helper to run a single ComfyUI workflow
 */
async function runSingleWorkflow(comfy: ComfyUIClient, item: ContentItem, type: 'SFW' | 'NSFW', seed: number, persona?: string) {
    let selectedWf: any = null

    // 1A. Check for explicit workflow override
    if (item.selected_workflow_id) {
        const { data: explicitWf } = await supabaseAdmin
            .from('comfyui_workflows')
            .select('*')
            .eq('id', item.selected_workflow_id)
            .single()

        // Only use the override if it matches the currently requested SFW/NSFW type
        if (explicitWf && explicitWf.workflow_type === type) {
            selectedWf = explicitWf
        }
    }

    // 1B. Fallback: Fetch matching workflow from DB dynamically
    if (!selectedWf) {
        let query = supabaseAdmin.from('comfyui_workflows').select('*').eq('workflow_type', type)
        if (persona) {
            query = query.or(`persona.eq.\${persona},persona.is.null`)
        } else {
            query = query.is('persona', null)
        }

        const { data: workflows, error: wfError } = await query

        if (wfError || !workflows || workflows.length === 0) {
            throw new Error(`No \${type} Workflow found in database for persona: \${persona || 'Shared'}`)
        }

        // Use the most recently uploaded workflow that matches
        selectedWf = workflows.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    }

    const workflowObj = selectedWf.workflow_json as any
    const nodeId = selectedWf.prompt_node_id

    // 2. Inject Prompt
    const finalPrompt = `${item.sfw_prompt}, ${type === 'NSFW' ? 'nsfw, uncensored' : 'sfw, high quality'}`
    if (workflowObj[nodeId] && workflowObj[nodeId].inputs) {
        workflowObj[nodeId].inputs.text = finalPrompt
    } else {
        throw new Error(`Invalid Target Node ID: ${nodeId} in Workflow: ${selectedWf.name}`)
    }

    // 3. Optional Settings (Dimensions, Batch Size) from Mapped Nodes
    if (selectedWf.batch_size_node_id && workflowObj[selectedWf.batch_size_node_id]?.inputs) {
        // Enforce Batch Size to 1 since our system iterates per content item externally.
        workflowObj[selectedWf.batch_size_node_id].inputs.batch_size = 1
    }

    // Width and Height can be overridden here if the system ever supports dynamic aspect ratios
    // For now, if the nodes are mapped, we just let them use the workflow defaults unless overridden.

    // 4. Inject Seed to Seed-capable nodes (Optional but good for reproducibility if KSampler is present)
    // We try to find a KSampler node to inject the seed
    for (const key in workflowObj) {
        if (workflowObj[key].class_type === 'KSampler' && workflowObj[key].inputs) {
            if ('seed' in workflowObj[key].inputs) workflowObj[key].inputs.seed = seed
            if ('noise_seed' in workflowObj[key].inputs) workflowObj[key].inputs.noise_seed = seed
        }
    }

    // 4. Send to ComfyUI
    const promptId = await comfy.queuePrompt(workflowObj)
    const images = await comfy.waitForImage(promptId)

    const originalFilename = images[0]
    const storageFilename = `${item.id}_${type}_${Date.now()}.png`
    const localDir = path.join(process.cwd(), 'storage', 'images', item.id, type)
    const localPath = path.join(localDir, storageFilename)

    await comfy.downloadImage(originalFilename, localPath)
    return { fileName: storageFilename, workflowSnapshot: workflowObj }
}

/**
 * Helper to record image in DB
 */
async function recordGeneratedImage(contentId: string, type: 'SFW' | 'NSFW', fileName: string, seed: number, podId: string, workflow: any) {
    const filePath = `/storage/images/${contentId}/${type}/${fileName}`
    await supabaseAdmin.from('generated_images').insert({
        content_item_id: contentId,
        image_type: type,
        file_path: filePath,
        file_name: fileName,
        seed,
        workflow_json: workflow,
        runpod_job_id: podId,
        status: 'Generated'
    })
}
