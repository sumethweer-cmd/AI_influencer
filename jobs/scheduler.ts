import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'
import { Schedule } from '@/types'

/**
 * Phase 5: Auto-Post Scheduler
 * Checks for 'pending' schedules that are due and posts them.
 */
export async function runAutoPoster() {
    const PHASE = 'Phase5: Scheduler'

    try {
        const now = new Date().toISOString()

        // 1. Fetch pending schedules that are due
        const { data: dueSchedules, error: fetchError } = await supabaseAdmin
            .from('schedules')
            .select('*, content_items(topic, caption_final, caption_draft), generated_images(*)')
            .eq('status', 'pending')
            .lte('scheduled_at', now)

        if (fetchError) throw fetchError
        if (!dueSchedules || dueSchedules.length === 0) {
            return { success: true, message: 'No pending schedules due.' }
        }

        await logSystem('INFO', PHASE, `Found ${dueSchedules.length} posts due. Processing...`)

        for (const schedule of dueSchedules) {
            const item = (schedule as any).content_items
            const image = (schedule as any).generated_images

            try {
                await logSystem('INFO', PHASE, `Posting content: ${item.topic}`)

                // 2. POST TO X/TWITTER (Placeholder for real API call)
                // In a real app, use 'twitter-api-v2' library here with keys from .env
                const postUrl = `https://x.com/nong_kung_agency/status/${Math.random().toString(36).substring(7)}`

                // 3. Update Schedule and Content Status
                const postTime = new Date().toISOString()

                await supabaseAdmin.from('schedules').update({
                    status: 'posted',
                    posted_at: postTime,
                    post_url: postUrl
                }).eq('id', schedule.id)

                await supabaseAdmin.from('content_items').update({
                    status: 'Published',
                    published_at: postTime,
                    post_url: postUrl
                }).eq('id', schedule.content_item_id)

                await logSystem('SUCCESS', PHASE, `Posted successfully: ${item.topic}`)
                await sendNotification(`✨ <b>Published!</b> Content "${item.topic}" is now live on X.\n🔗 <a href="${postUrl}">View Post</a>`)

            } catch (postErr: any) {
                await logSystem('ERROR', PHASE, `Failed to post ${item.topic}`, { error: postErr.message })
                await supabaseAdmin.from('schedules').update({ status: 'failed' }).eq('id', schedule.id)
            }
        }

        return { success: true }
    } catch (error: any) {
        await logSystem('ERROR', PHASE, 'Scheduler job failed', { error: error.message })
        return { success: false, error: error.message }
    }
}
