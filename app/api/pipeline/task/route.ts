import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// Marks a render task as downloaded (and where you saved it). Does not touch RunningHub.
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const body = await req.json().catch(() => ({}))
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
        const patch: Record<string, unknown> = { downloaded: body.downloaded !== false, updated_at: new Date().toISOString() }
        if (typeof body.local_path === 'string') patch.local_path = body.local_path.slice(0, 500)
        const { error } = await supabaseAdmin.from('render_tasks').update(patch).eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
