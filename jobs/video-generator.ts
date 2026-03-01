import { getActivePods, waitForComfyUI } from '@/lib/runpod'
import { ComfyUIClient } from '@/lib/comfyui'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import path from 'path'
import fs from 'fs'

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

        // 4. Upload Source Image to ComfyUI
        const absoluteImagePath = path.join(process.cwd(), img.file_path)
        if (!fs.existsSync(absoluteImagePath)) {
            throw new Error(`Source image file not found: ${absoluteImagePath}`)
        }

        const comfyFilename = `input_for_vdo_${imageId}${path.extname(img.file_path)}`
        await comfy.uploadImage(absoluteImagePath, comfyFilename)

        // 5. Prepare Workflow
        const workflowObj = JSON.parse(JSON.stringify(workflow.workflow_json))
        const imageNodeId = workflow.video_image_node_id || 'load_image_node' // Fallback or convention
        const promptNodeId = workflow.video_prompt_node_id || 'prompt_node'

        if (workflowObj[imageNodeId]) {
            workflowObj[imageNodeId].inputs.image = comfyFilename
        }

        if (workflowObj[promptNodeId]) {
            workflowObj[promptNodeId].inputs.text = userPrompt || img.vdo_prompt || ''
        }

        // 6. Queue and Wait
        const promptId = await comfy.queuePrompt(workflowObj)
        const outputs = await comfy.waitForImage(promptId)

        if (!outputs || outputs.length === 0) {
            throw new Error('ComfyUI produced no outputs.')
        }

        // 7. Download Video
        const videoOutput = outputs[0] // Assume first output is the video
        const videoExt = typeof videoOutput === 'string' ? path.extname(videoOutput) : (videoOutput.filename.split('.').pop() || 'mp4')
        const storageFilename = `vdo_${imageId}_${Date.now()}.${videoExt}`
        const localDir = path.join(process.cwd(), 'storage', 'videos', img.content_item_id, 'generated')
        const localPath = path.join(localDir, storageFilename)

        await comfy.downloadImage(videoOutput, localPath)

        // 8. Record in DB as a NEW entry in generated_images with type 'video'
        const dbVideoPath = `/storage/videos/${img.content_item_id}/generated/${storageFilename}`
        const { error: videoRecErr } = await supabaseAdmin.from('generated_images').insert({
            content_item_id: img.content_item_id,
            image_type: img.image_type,
            file_path: dbVideoPath,
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
        return { success: true, path: dbVideoPath }

    } catch (err: any) {
        console.error('Video Generation Failed:', err)
        await supabaseAdmin.from('generated_images').update({ vdo_status: 'failed' }).eq('id', imageId)
        await logSystem('ERROR', 'Video Queue', `Video generation failed for ${imageId}`, { error: err.message })
        throw err
    }
}
