import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// Sets (or clears) the planned posting date of a content (calendar view).
//   PATCH -> { id, date: 'YYYY-MM-DD' | null }
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const b = await req.json().catch(() => ({}))
        const date = b.date === null || b.date === '' ? null : String(b.date)
        if (!b.id || (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return NextResponse.json({ success: false, error: 'id and date (YYYY-MM-DD or null) are required' }, { status: 400 })
        const { error } = await supabaseAdmin.from('pipeline_content_items').update({ scheduled_date: date }).eq('id', b.id).is('parent_content_item_id', null)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
