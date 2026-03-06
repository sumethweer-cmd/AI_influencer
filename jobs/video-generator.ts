import { getActivePods, waitForComfyUI } from '@/lib/runpod'
import { ComfyUIClient } from '@/lib/comfyui'
import { supabaseAdmin, logSystem, uploadToStorage } from '@/lib/supabase'
import { generateVideoPrompts } from '@/lib/gemini'
import path from 'path'

/**
 * 1:1 Video Generation Logic
 * Triggered per image variant from the Asset Hub.
 */
export async function generateVideoFromImage(imageId: string, userPrompt?: string) {
    console.log(`--- Starting 1:1 Video Generation for Image: ${imageId} ---`)

    // 1. Fetch image and content item details
    const { data: img, error: imgErr } = await supabaseAdmin
        .from('generated_images')
        .select('*, content_items(*)')
        .eq('id', imageId)
        .single()

    if (imgErr || !img) {
        throw new Error(`Image not found: ${imgErr?.message || 'Unknown'}`)
    }

    // 2. Fetch Video Workflow
    // Priority: is_active = true, then most recent.
    let { data: workflow, error: wfErr } = await supabaseAdmin
        .from('comfyui_workflows')
        .select('*')
        .eq('workflow_type', 'Video')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (wfErr || !workflow) {
        // Fallback to most recent Video workflow if no active one found
        const { data: fallbackWf, error: fbErr } = await supabaseAdmin
            .from('comfyui_workflows')
            .select('*')
            .eq('workflow_type', 'Video')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        workflow = fallbackWf
        if (fbErr || !workflow) throw new Error('No Video Workflow found in database. Please upload one first.')
    }

    try {
        // Update status to 'pending'
        await supabaseAdmin.from('generated_images').update({ vdo_status: 'pending' }).eq('id', imageId)

        // 3. Find Active Pod
        const activePods = await getActivePods()
        const runningPod = activePods.find(p => p.desiredStatus === 'RUNNING')

        if (!runningPod) {
            throw new Error('NO_ACTIVE_POD: Please start a Runpod instance first.')
        }

        const podId = runningPod.id
        const comfyUrl = await waitForComfyUI(podId)
        const comfy = new ComfyUIClient(comfyUrl)

        await supabaseAdmin.from('generated_images').update({
            vdo_status: 'processing',
            vdo_job_id: podId
        }).eq('id', imageId)

        // 4. Upload Source Image to ComfyUI from Supabase URL
        if (!img.file_path.startsWith('http')) {
            throw new Error(`Cannot generate video from local image in serverless environment. Image must be migrated to Supabase first: ${img.file_path}`)
        }

        const fileExt = img.file_path.split('.').pop() || 'png'
        const comfyFilename = `input_for_vdo_${imageId}.${fileExt}`
        await comfy.uploadImageFromUrl(img.file_path, comfyFilename)

        // 4.5. AUTO-SPLIT: If vdo_prompt_1/2/3 are null but base prompt exists, auto-generate them
        if (!img.vdo_prompt_1 && img.vdo_prompt) {
            await logSystem('INFO', 'Video Queue', `No split prompts for ${imageId} — auto-splitting with AI...`)
            try {
                const splitPrompts = await generateVideoPrompts(img.vdo_prompt, img.image_type || 'SFW')
                if (splitPrompts && splitPrompts.length >= 3) {
                    await supabaseAdmin.from('generated_images').update({
                        vdo_prompt_1: splitPrompts[0],
                        vdo_prompt_2: splitPrompts[1],
                        vdo_prompt_3: splitPrompts[2]
                    }).eq('id', imageId)
                    // Update local img object so nodes get the new prompts below
                    img.vdo_prompt_1 = splitPrompts[0]
                    img.vdo_prompt_2 = splitPrompts[1]
                    img.vdo_prompt_3 = splitPrompts[2]
                    await logSystem('INFO', 'Video Queue', `Auto-split complete for ${imageId}`, { prompts: splitPrompts })
                }
            } catch (splitErr: any) {
                await logSystem('WARNING', 'Video Queue', `Auto-split failed for ${imageId}, using base prompt`, { error: splitErr.message })
            }
        }
        const workflowObj = JSON.parse(JSON.stringify(workflow.workflow_json))
        const imageNodeId = workflow.video_image_node_id || 'load_image_node' // Fallback or convention
        const promptNodeId = workflow.video_prompt_node_id
        const promptNodeId2 = workflow.video_prompt_2_node_id
        const promptNodeId3 = workflow.video_prompt_3_node_id

        if (workflowObj[imageNodeId]) {
            workflowObj[imageNodeId].inputs.image = comfyFilename
        }

        if (promptNodeId && workflowObj[promptNodeId]) {
            workflowObj[promptNodeId].inputs.text = img.vdo_prompt_1 || userPrompt || img.vdo_prompt || 'Begin the scene'
        }
        
        if (promptNodeId2 && workflowObj[promptNodeId2]) {
            workflowObj[promptNodeId2].inputs.text = img.vdo_prompt_2 || userPrompt || img.vdo_prompt || 'Continue the scene'
        }

        if (promptNodeId3 && workflowObj[promptNodeId3]) {
            workflowObj[promptNodeId3].inputs.text = img.vdo_prompt_3 || userPrompt || img.vdo_prompt || 'Conclude the scene'
        }

        // 6. Queue and Wait
        const promptId = await comfy.queuePrompt(workflowObj)
        const outputs = await comfy.waitForImage(promptId)

        if (!outputs || outputs.length === 0) {
            throw new Error('ComfyUI produced no outputs.')
        }

        // 7. Download Video
        const videoOutput = outputs[0] // Assume first output is the video
        const videoExt = typeof videoOutput === 'string' ? path.extname(videoOutput).replace('.', '') : (videoOutput.filename.split('.').pop() || 'mp4')
        const storageFilename = `vdo_${imageId}_${Date.now()}.${videoExt}`
        const storageBucketPath = `videos/${img.content_item_id}/generated/${storageFilename}`

        const videoBuffer = await comfy.downloadImageAsBuffer(videoOutput)
        const contentType = videoExt === 'mp4' ? 'video/mp4' : (videoExt === 'webm' ? 'video/webm' : 'application/octet-stream')

        const publicUrl = await uploadToStorage('content', storageBucketPath, videoBuffer, contentType)

        // 8. Record in DB as a NEW entry in generated_images with type 'video'
        const { error: videoRecErr } = await supabaseAdmin.from('generated_images').insert({
            content_item_id: img.content_item_id,
            image_type: img.image_type,
            file_path: publicUrl,
            file_name: storageFilename,
            status: 'Generated',
            media_type: 'video',
            gen_attempt: (img.gen_attempt || 0) + 1,
            seed: img.seed || 0
        })

        if (videoRecErr) throw videoRecErr

        // Update original image status to completed
        await supabaseAdmin.from('generated_images').update({ vdo_status: 'completed' }).eq('id', imageId)

        await logSystem('SUCCESS', 'Video Queue', `Video generated for image ${imageId}`)
        return { success: true, path: publicUrl }

    } catch (err: any) {
        console.error('Video Generation Failed:', err)
        await supabaseAdmin.from('generated_images').update({ vdo_status: 'failed' }).eq('id', imageId)
        await logSystem('ERROR', 'Video Queue', `Video generation failed for ${imageId}`, { error: err.message })
        throw err
    }
}
