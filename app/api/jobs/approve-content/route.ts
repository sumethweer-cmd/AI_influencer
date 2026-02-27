import { NextResponse } from 'next/server'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'

/**
 * Phase 4: Approve Content API
 * Updates status to 'Scheduled' and sets the post time
 */
export async function POST(request: Request) {
    const { contentId, scheduledAt, selectedImageId } = await request.json()

    try {
        // 1. Update Content Item status
        const { error: itemError } = await supabaseAdmin
            .from('content_items')
            .update({
                status: 'Scheduled',
                scheduled_at: scheduledAt
            })
            .eq('id', contentId)

        if (itemError) throw itemError

        // 2. Create Schedule record
        const { error: scheduleError } = await supabaseAdmin
            .from('schedules')
            .insert({
                content_item_id: contentId,
                selected_image_id: selectedImageId,
                scheduled_at: scheduledAt,
                status: 'pending'
            })

        if (scheduleError) throw scheduleError

        await logSystem('SUCCESS', 'Phase4: Approval', `Content ${contentId} approved for ${scheduledAt}`)
        await sendNotification(`🗓️ <b>Content Approved:</b> Item #${contentId} scheduled for <b>${new Date(scheduledAt).toLocaleString()}</b>`)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
