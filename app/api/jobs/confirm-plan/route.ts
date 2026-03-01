import { NextResponse } from 'next/server'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'

export async function POST(request: Request) {
    try {
        const { itemIds } = await request.json()
        if (!itemIds || itemIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 })
        }

        // 1. Initial Queueing (Safely marks all as queued for the Webhook to pick up iteratively)
        const { error: queueError } = await supabaseAdmin
            .from('content_items')
            .update({ status: 'Queued for Production' })
            .in('id', itemIds)

        if (queueError) throw queueError

        // 2. Trigger the very first item explicitly to start the Webhook Cascade!
        // We order by sequence_number so the batch runs chronologically
        const { data: firstToRun } = await supabaseAdmin.from('content_items')
            .select('id')
            .in('id', itemIds)
            .order('sequence_number', { ascending: true })
            .limit(1)
            .single()

        if (firstToRun) {
            await supabaseAdmin.from('content_items')
                .update({ status: 'In Production' })
                .eq('id', firstToRun.id)
        }

        await logSystem('SUCCESS', 'Phase 1.5: Confirm Plan', `Queued ${itemIds.length} items for Background Generation. Triggered cascade.`)
        await sendNotification(`⚙️ <b>Phase 1.5:</b> Confirmed ${itemIds.length} draft items. Background Webhook queue started!`)

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
