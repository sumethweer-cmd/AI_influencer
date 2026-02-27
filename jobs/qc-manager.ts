import { performImageQC } from '@/lib/gemini'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'
import { GeneratedImage, QCFeedback } from '@/types'
import fs from 'fs'

/**
 * Main Job: The AI-QC Manager
 * Checks all images with status 'Generated' using Gemini Vision.
 */
export async function runQCManager() {
    const PHASE = 'Phase3: AI-QC'

    try {
        await logSystem('INFO', PHASE, 'Starting AI-QC Batch...')

        // 1. Fetch images to check
        const { data: images, error: fetchError } = await supabaseAdmin
            .from('generated_images')
            .select('*, content_items(sfw_prompt)')
            .eq('status', 'Generated')

        if (fetchError) throw fetchError
        if (!images || images.length === 0) {
            await logSystem('INFO', PHASE, 'No images to QC.')
            return { success: true, message: 'No images' }
        }

        await sendNotification(`🔍 <b>Phase 3:</b> QC checking ${images.length} images...`)

        let passCount = 0
        let failCount = 0

        // 2. Process each image
        for (const img of images) {
            const gImg = img as any as GeneratedImage & { content_items: { sfw_prompt: string } }

            await logSystem('INFO', PHASE, `Checking Image ID: ${gImg.id} (${gImg.image_type})`)

            // Logic to actually perform QC with Gemini Vision
            // In production, this would read the local file or fetch from storage
            const feedback: QCFeedback = await performImageQC(gImg.file_path, gImg.content_items.sfw_prompt)

            const newStatus = feedback.recommendation === 'pass' ? 'QC_Pass' : 'QC_Fail'

            // Update image record
            const { error: updateError } = await supabaseAdmin
                .from('generated_images')
                .update({
                    quality_score: feedback.overall_score,
                    qc_feedback: feedback,
                    status: newStatus
                })
                .eq('id', gImg.id)

            if (updateError) throw updateError

            // If QC Pass, also update Content Item status if all its images are checked
            if (newStatus === 'QC_Pass') {
                passCount++
                await checkAndUpdateItemStatus(gImg.content_item_id)
            } else {
                failCount++
                // TRIGGER RE-GEN LOOP (Phase 2)
                await logSystem('WARNING', PHASE, `Image failed QC. Score: ${feedback.overall_score}. Triggering Re-gen soon.`)
            }
        }

        await logSystem('SUCCESS', PHASE, `QC Batch complete. PASS: ${passCount}, FAIL: ${failCount}`)
        await sendNotification(`✅ <b>Phase 3 Complete:</b> QC finished. Pass: ${passCount}, Fail: ${failCount}. Approved items are now <b>Awaiting Approval</b>.`)

        return { success: true }
    } catch (error: any) {
        await logSystem('ERROR', PHASE, 'QC Job failed', { error: error.message })
        await sendNotification(`❌ <b>Phase 3 Error:</b> ${error.message}`)
        return { success: false, error: error.message }
    }
}

/**
 * Check if a content item is ready for review
 */
async function checkAndUpdateItemStatus(contentId: string) {
    const { data: images } = await supabaseAdmin
        .from('generated_images')
        .select('status, image_type')
        .eq('content_item_id', contentId)

    if (!images) return

    const allPassed = images.length > 0 && images.every((img: any) => img.status === 'QC_Pass')

    if (allPassed) {
        await supabaseAdmin
            .from('content_items')
            .update({ status: 'Awaiting Approval' })
            .eq('id', contentId)

        await logSystem('INFO', 'Phase3: AI-QC', `Content Item ${contentId} moved to Awaiting Approval.`)
    }
}
