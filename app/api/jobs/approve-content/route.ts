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
        // 1. Fetch current content item to get latest platform_selections/audio_ref
        const { data: item, error: fetchError } = await supabaseAdmin
            .from('content_items')
            .select('*')
            .eq('id', contentId)
            .single()

        if (fetchError) throw fetchError

        // 2. Update Content Item status
        const { error: itemUpdateError } = await supabaseAdmin
            .from('content_items')
            .update({
                status: 'Scheduled',
                scheduled_at: scheduledAt,
                selected_image_id: selectedImageId // Primary image
            })
            .eq('id', contentId)

        if (itemUpdateError) throw itemUpdateError

        // 3. Update Generated Images Status (Mark unselected as Rejected)
        // We need to be careful here if multiple images are selected across platforms
        const allSelectedIds = new Set<string>()
        if (selectedImageId) allSelectedIds.add(selectedImageId)

        const selections = item.platform_selections as Record<string, any> || {}
        Object.values(selections).forEach(val => {
            if (val && typeof val === 'object') {
                if (Array.isArray(val.media)) val.media.forEach((id: string) => allSelectedIds.add(id))
                if (val.cover) allSelectedIds.add(val.cover)
            } else if (val) {
                if (Array.isArray(val)) val.forEach((id: string) => allSelectedIds.add(id))
                else allSelectedIds.add(val)
            }
        })

        if (allSelectedIds.size > 0) {
            await supabaseAdmin
                .from('generated_images')
                .update({ status: 'Approved' })
                .in('id', Array.from(allSelectedIds))

            await supabaseAdmin
                .from('generated_images')
                .update({ status: 'Rejected' })
                .eq('content_item_id', contentId)
                .not('id', 'in', `(${Array.from(allSelectedIds).join(',')})`)
        }

        // 4. Create Schedule records for each platform
        const platforms = Object.keys(selections)
        if (platforms.length === 0) {
            // Fallback: Create one generic schedule if no platforms selected
            await supabaseAdmin
                .from('schedules')
                .insert({
                    content_item_id: contentId,
                    selected_image_id: selectedImageId,
                    scheduled_at: scheduledAt,
                    status: 'pending',
                    platform: 'generic'
                })
        } else {
            const scheduleInserts = platforms.map(platform => {
                const config = selections[platform]
                const isStructured = config && typeof config === 'object' && !Array.isArray(config)

                return {
                    content_item_id: contentId,
                    selected_image_id: isStructured ? (config.media?.[0] || null) : (Array.isArray(config) ? config[0] : config),
                    additional_image_ids: isStructured ? (config.media || []) : (Array.isArray(config) ? config : []),
                    platform,
                    scheduled_at: scheduledAt,
                    status: 'pending'
                }
            })

            const { error: scheduleError } = await supabaseAdmin
                .from('schedules')
                .insert(scheduleInserts)

            if (scheduleError) throw scheduleError
        }

        await logSystem('SUCCESS', 'Phase4: Approval', `Content ${contentId} approved for ${scheduledAt} across ${platforms.length || 1} platforms`)
        await sendNotification(`🗓️ <b>Content Approved:</b> Item #${contentId} scheduled for <b>${new Date(scheduledAt).toLocaleString()}</b> across ${platforms.join(', ') || 'platforms'}`)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
