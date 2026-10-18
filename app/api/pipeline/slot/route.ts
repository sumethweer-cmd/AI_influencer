import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// Sets (or clears) <Picture N> of one content to a library asset. The library file itself is never
// deleted; only the slot row is replaced.
export const dynamic = 'force-dynamic'
const BUCKET = 'pipeline-assets'

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const b = await req.json().catch(() => ({}))
        const contentId = String(b.contentId || '')
        const slot = Number(b.slot)
        if (!contentId || !(slot >= 1 && slot <= 3)) return NextResponse.json({ success: false, error: 'contentId and slot (1-3) are required' }, { status: 400 })

        // remove the current picture in this slot (rows only; delete the file only if it is not a library file)
        const { data: old } = await supabaseAdmin
            .from('pipeline_assets')
            .select('id,storage_path')
            .eq('content_item_id', contentId)
            .eq('picture_slot', slot)
        for (const o of old || []) {
            if (o.storage_path && !String(o.storage_path).replace(`${BUCKET}/`, '').startsWith('library/')) {
                await supabaseAdmin.storage.from(BUCKET).remove([String(o.storage_path).replace(`${BUCKET}/`, '')])
            }
        }
        if (old?.length) await supabaseAdmin.from('pipeline_assets').delete().in('id', old.map((o: { id: string }) => o.id))

        if (b.assetId) {
            const { data: src, error } = await supabaseAdmin
                .from('pipeline_assets')
                .select('character,label,storage_path,url,content_type,size_bytes')
                .eq('id', b.assetId)
                .single()
            if (error || !src) return NextResponse.json({ success: false, error: 'ไม่พบรูปในคลัง' }, { status: 404 })
            const { error: insErr } = await supabaseAdmin.from('pipeline_assets').insert({
                character: src.character,
                label: `Picture ${slot} · ${src.label}`,
                storage_path: src.storage_path,
                url: src.url,
                content_type: src.content_type,
                size_bytes: src.size_bytes,
                asset_type: 'reference',
                content_item_id: contentId,
                picture_slot: slot,
            })
            if (insErr) throw insErr
        }
        return NextResponse.json({ success: true })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
