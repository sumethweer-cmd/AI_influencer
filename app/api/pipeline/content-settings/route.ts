import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// Saves per-content render settings (continuity per segment, resolution) inside the main row's note JSON.
// PATCH { contentId, continuity?: { "2": "shot" | "context", ... }, resolution?: string | null }
// Merges with whatever is already in the note (frames, source, ...). Used by the page and by the auto
// dispatcher (queued contents keep the settings they had when queued).
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const b = await req.json().catch(() => ({}))
        const contentId = String(b.contentId || '')
        if (!contentId) return NextResponse.json({ success: false, error: 'contentId is required' }, { status: 400 })

        const { data: row, error } = await supabaseAdmin.from('pipeline_content_items').select('id,note').eq('id', contentId).single()
        if (error || !row) return NextResponse.json({ success: false, error: 'ไม่พบ content' }, { status: 404 })
        let note: Record<string, unknown> = {}
        try {
            note = JSON.parse(row.note || '{}')
        } catch {
            return NextResponse.json({ success: false, error: 'note ของ content นี้ไม่ใช่ JSON จึงไม่แก้ให้ (กันข้อความเดิมหาย)' }, { status: 409 })
        }

        if (b.continuity && typeof b.continuity === 'object') {
            const cont: Record<string, string> = { ...((note.continuity as Record<string, string>) || {}) }
            for (const [k, v] of Object.entries(b.continuity as Record<string, unknown>)) {
                if (!/^\d+$/.test(k)) continue
                if (v === 'shot' || v === 'context') cont[k] = v
            }
            delete cont['1'] // segment 1 is always a shot
            note.continuity = cont
        }
        if (b.resolution !== undefined) {
            const r = typeof b.resolution === 'string' ? b.resolution.trim().slice(0, 40) : ''
            if (r) note.resolution = r
            else delete note.resolution
        }

        const { error: upErr } = await supabaseAdmin.from('pipeline_content_items').update({ note: JSON.stringify(note) }).eq('id', contentId)
        if (upErr) throw upErr
        return NextResponse.json({ success: true, note })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
