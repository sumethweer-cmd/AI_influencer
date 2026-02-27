import { NextResponse } from 'next/server'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'

export async function POST(request: Request) {
    try {
        const { itemIds } = await request.json()
        if (!itemIds || itemIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 })
        }

        const { error } = await supabaseAdmin
            .from('content_items')
            .update({ status: 'In Production' })
            .in('id', itemIds)

        if (error) throw error

        await logSystem('SUCCESS', 'Phase 1.5: Confirm Plan', `Moved ${itemIds.length} items to Production phase`)
        await sendNotification(`⚙️ <b>Phase 1.5:</b> Confirmed ${itemIds.length} draft items. Moved to <i>In Production</i>. Ready for Phase 2 Batch!`)

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
