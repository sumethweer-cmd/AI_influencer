import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// Saves an edited prompt for ONE segment row (pipeline_content_items.compiled_prompt).
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const body = await req.json().catch(() => ({}))
        const id = String(body.id || '')
        const prompt = typeof body.compiled_prompt === 'string' ? body.compiled_prompt : ''
        if (!id || !prompt.trim()) return NextResponse.json({ success: false, error: 'id and compiled_prompt are required' }, { status: 400 })
        const { error } = await supabaseAdmin.from('pipeline_content_items').update({ compiled_prompt: prompt }).eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
