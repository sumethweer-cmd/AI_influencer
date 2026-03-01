import { getActivePods, waitForComfyUI, getPodDetails } from '@/lib/runpod'
import { ComfyUIClient } from '@/lib/comfyui'
import { supabaseAdmin, logSystem, uploadToStorage } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'
import { ContentItem } from '@/types'
import { getConfig } from '@/lib/config'
import path from 'path'

/**
 * Phase 2 & 2.5: The Master Orchestrator for Image Production
 * Runs in the background (or triggered via API).
 */
export async function runProductionBatch(itemIds?: string[], specificIndex?: number, forceType?: 'SFW' | 'NSFW') {
    console.log('--- Starting Production Batch ---')

    let query = supabaseAdmin.from('content_items').select('*')
    if (itemIds && itemIds.length > 0) {
        query = query.in('id', itemIds)
    } else {
        query = query.eq('status', 'In Production')
    }

    const { data: items, error: fetchErr } = await query.order('sequence_number', { ascending: true })

    if (fetchErr || !items || items.length === 0) {
        console.log('No items in production queue.')
        return { success: true, message: 'No items in production queue.' }
    }

    console.log(`Found ${items.length} items to produce.`)

    // 0. Initialize or Find Active Monitoring Job
    let jobId = ''
    try {
        const { data: job, error: jobErr } = await supabaseAdmin
            .from('production_jobs')
            .insert({
                status: 'Checking Active Pods',
                total_items: items.length * 2, // Estimate 2 generations per item (SFW/NSFW) worst case.
                completed_items: 0,
                current_item_id: items[0].id
            })
            .select('id')
            .single()

        if (!jobErr && job) jobId = job.id
    } catch (e) { console.error('Failed to create job tracking row', e) }

    const updateJob = async (status: string, currentItemId?: string, addCompleted: number = 0) => {
        if (!jobId) return
        try {
            const { data: currentData } = await supabaseAdmin.from('production_jobs').select('completed_items').eq('id', jobId).single();
            const { error: updErr } = await supabaseAdmin.from('production_jobs').update({
                status: status,
                current_item_id: currentItemId || items[0].id,
                completed_items: (currentData?.completed_items || 0) + addCompleted,
                updated_at: new Date().toISOString()
            }).eq('id', jobId)

            if (status.includes('Completed') || status.includes('Failed')) {
                await supabaseAdmin.from('production_jobs').update({ completed_at: new Date().toISOString() }).eq('id', jobId)
            }
        } catch (e) { /* ignore */ }
    }

    let podId = ''
    let comfyUrl = ''

    try {
        // 1. Check for Active Pods instead of Deploying
        await updateJob('Checking for Active Pods')
        const activePods = await getActivePods()
        const runningPod = activePods.find(p => p.desiredStatus === 'RUNNING')

        if (!runningPod) {
            throw new Error('NO_ACTIVE_POD: Please start a Runpod instance from the Control Center first.')
        }

        podId = runningPod.id
        await updateJob('Waiting for ComfyUI', undefined, 0)
        comfyUrl = await waitForComfyUI(podId)

        // 3. Connect to ComfyUI via robust Proxy URL
        const comfy = new ComfyUIClient(comfyUrl)
        await logSystem('INFO', 'Phase2: Production', `ComfyUI is ready at ${comfyUrl}. Starting generation loop...`)

        const globalBatchSizeStr = await getConfig('PRODUCTION_BATCH_SIZE')
        const globalBatchSize = globalBatchSizeStr ? parseInt(globalBatchSizeStr) : null

        let iterCount = 0
        let processedCount = 0

        // 5. Process each item (Limit to 1 per execution to avoid Vercel timeouts)
        for (let i = 0; i < items.length; i++) {
            const item = items[i] as ContentItem

            if (processedCount >= 1) {
                // Stop processing to stay under the 5-minute Vercel Serverless limit
                // The frontend loop will ping again to pick up the next item.
                await updateJob('Waiting for next cycle', undefined, 0)
                return { success: true, hasMore: true }
            }

            await updateJob('Generating', item.id, 0)

            await logSystem('INFO', 'Phase2: Production', `Processing Item #${item.sequence_number}: ${item.topic}`)

            // Update status to 'In Production'
            await supabaseAdmin.from('content_items').update({ status: 'In Production' }).eq('id', item.id)

            try {
                const totalExpected = item.batch_size || 4

                // SFW Generation Loop
                if (item.gen_sfw && (forceType === 'SFW' || !forceType)) {
                    for (let poseIdx = 0; poseIdx < totalExpected; poseIdx++) {
                        // Skip if specificIndex provided and this isn't it
                        if (specificIndex !== undefined && poseIdx !== specificIndex) continue

                        // Skip if not forced and image already exists for this slot
                        const existingSfw = item.generated_images?.find((img: any) => img.image_type === 'SFW' && img.slot_index === poseIdx)
                        if (!forceType && existingSfw) continue

                        const loopSeed = Math.floor(Math.random() * 1000000000)
                        const sfwRes = await runSingleWorkflow(comfy, item, 'SFW', loopSeed, item.persona, poseIdx)
                        for (const fileObj of sfwRes.fileNames) {
                            await recordGeneratedImage(item.id, 'SFW', fileObj.filename, fileObj.url, loopSeed, podId, sfwRes.workflowSnapshot, sfwRes.vdoPrompt, poseIdx)
                        }
                    }
                    await updateJob('Generating', item.id, 1)
                }

                // NSFW Generation Loop
                if (item.gen_nsfw && (forceType === 'NSFW' || !forceType)) {
                    for (let poseIdx = 0; poseIdx < totalExpected; poseIdx++) {
                        // Skip if specificIndex provided and this isn't it
                        if (specificIndex !== undefined && poseIdx !== specificIndex) continue

                        // Skip if not forced and image already exists for this slot
                        const existingNsfw = item.generated_images?.find((img: any) => img.image_type === 'NSFW' && img.slot_index === poseIdx)
                        if (!forceType && existingNsfw) continue

                        const loopSeed = Math.floor(Math.random() * 1000000000)
                        const nsfwRes = await runSingleWorkflow(comfy, item, 'NSFW', loopSeed, item.persona, poseIdx)
                        for (const fileObj of nsfwRes.fileNames) {
                            await recordGeneratedImage(item.id, 'NSFW', fileObj.filename, fileObj.url, loopSeed, podId, nsfwRes.workflowSnapshot, nsfwRes.vdoPrompt, poseIdx)
                        }
                    }
                    await updateJob('Generating', item.id, 1)
                }

                // Update status to 'QC Pending'
                await supabaseAdmin.from('content_items').update({ status: 'QC Pending' }).eq('id', item.id)
                processedCount++
                iterCount++
            } catch (itemErr: any) {
                console.error(`Error processing item ${item.id}:`, itemErr)
                await logSystem('ERROR', 'Phase2: Production', `Item #${item.sequence_number} failed. Reverting to Draft.`, { error: itemErr.message })
                await supabaseAdmin.from('content_items').update({ status: 'Draft' }).eq('id', item.id)
                processedCount++
                // We count this as processed so we exit the loop, preventing the NEXT item from failing via timeout
            }
        }

        await updateJob('Completed', undefined, 0)

        await logSystem('SUCCESS', 'Phase2: Production', 'Batch cycle completed.')
        if (iterCount > 0 && items.length <= 1) {
            await sendNotification(`✨ <b>Phase 2 Complete:</b> Produced images for items. Moving to QC...`)
        }
        console.log('--- Production Batch Completed ---')

        return { success: true, hasMore: false }
    } catch (err: any) {
        console.error('Batch Production Error:', err)
        await updateJob(err.message.includes('NO_ACTIVE_POD') ? 'Failed: No Pod Running' : 'Failed')

        // Revert items back to Draft if we couldn't even start
        if (err.message.includes('NO_ACTIVE_POD')) {
            for (const item of items) {
                await supabaseAdmin.from('content_items').update({ status: 'Draft' }).eq('id', item.id)
            }
        }
        await logSystem('ERROR', 'Phase2: Production', 'Batch failed', { error: err.message })
        await sendNotification(`❌ <b>Phase 2 Error:</b> ${err.message}`)
        console.log('--- Production Batch Completed ---')
        return { success: false, error: err.message }
    } finally {
        // No need to terminate pod as we are using an existing one.
        // The pod should be terminated by the Control Center or another process.
    }
}

/**
 * Helper to run a single ComfyUI workflow
 */
async function runSingleWorkflow(comfy: ComfyUIClient, item: ContentItem, type: 'SFW' | 'NSFW', seed: number, persona?: string, poseIndex: number = 0) {
    let selectedWf: any = null

    // 1A. Check for explicit workflow override
    if (item.selected_workflow_id) {
        const { data: explicitWf } = await supabaseAdmin
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
        // Fetch all workflows
        const { data: workflows, error: wfError } = await supabaseAdmin
            .from('comfyui_workflows')
            .select('*')

        if (wfError || !workflows || workflows.length === 0) {
            throw new Error(`No workflows found in database. Please upload at least one in Template Studio.`)
        }

        // SMART SELECTION (Simplified):
        // 1. Exact Persona match (newest)
        // 2. Shared/Global (persona is NULL) (newest)
        // This ignores 'workflow_type' because the user wants a unified workflow.

        const personaMatches = workflows.filter((w: any) => w.persona === persona)
        const globalMatches = workflows.filter((w: any) => !w.persona)

        if (personaMatches.length > 0) {
            selectedWf = personaMatches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        } else if (globalMatches.length > 0) {
            selectedWf = globalMatches.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        } else {
            // Absolute fallback: just the newest one available
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
        const { data: personaData } = await supabaseAdmin.from('ai_personas').select('trigger_word, instruction_rule').eq('name', persona).single()
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

    // Filter empty/duplicate and join
    // We use a Set to avoid redundant commas if two fields are identical or empty
    const dynamicPrompt = Array.from(new Set(parts.filter(p => p && String(p).trim() !== ''))).join(', ')

    // Prepend the base prompt from the workflow if it exists
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
    // Fetch Global Settings
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

    const downloadedFiles = []

    // Download ALL images generated from this batch
    for (let i = 0; i < images.length; i++) {
        const imgItem = images[i]
        const originalFilename = typeof imgItem === 'string' ? imgItem : imgItem.filename
        const storageFilename = `${item.id}_${type}_${Date.now()}_${i}.png`
        const storageBucketPath = `images/${item.id}/${type}/${storageFilename}`

        const imageBuffer = await comfy.downloadImageAsBuffer(imgItem)

        // Upload to Supabase 'content' bucket
        const publicUrl = await uploadToStorage('content', storageBucketPath, imageBuffer, 'image/png')

        downloadedFiles.push({ filename: storageFilename, url: publicUrl })
    }

    const vdoPrompts = type === 'NSFW' ? struct.vdo_prompts_nsfw : struct.vdo_prompts
    const vdoPromptUsed = (vdoPrompts && vdoPrompts.length > poseIndex) ? vdoPrompts[poseIndex] : ''

    return { fileNames: downloadedFiles, workflowSnapshot: workflowObj, vdoPrompt: vdoPromptUsed }
}

/**
 * Helper to record image in DB
 */
async function recordGeneratedImage(contentId: string, type: 'SFW' | 'NSFW', fileName: string, fileUrl: string, seed: number, podId: string, workflow: any, vdoPrompt?: string, slotIndex?: number) {
    await supabaseAdmin.from('generated_images').insert({
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
