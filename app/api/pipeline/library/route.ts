import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// Reference-picture library: general assets (not tied to one content) that any content can use.
//   GET  -> list
//   POST -> { filename, character } -> short-lived signed upload token (browser then uploads straight to Storage)
//   PUT  -> { path, url, character, label, contentType, sizeBytes } -> records the uploaded file as a library asset
export const dynamic = 'force-dynamic'
const BUCKET = 'pipeline-assets'

export async function GET() {
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const { data, error } = await supabaseAdmin
            .from('pipeline_assets')
            .select('id,character,label,url,content_type,created_at')
            .is('content_item_id', null)
            .eq('asset_type', 'reference')
            .order('created_at', { ascending: false })
            .limit(500)
        if (error) throw error
        return NextResponse.json({ success: true, assets: data })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const { filename, character } = await req.json().catch(() => ({}))
        if (!filename) return NextResponse.json({ success: false, error: 'filename is required' }, { status: 400 })
        const clean = String(filename).replace(/[^a-zA-Z0-9.-]/g, '_')
        const who = String(character || 'shared').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'shared'
        const path = `library/${who}/${Date.now()}-${clean}`
        const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
        if (error) throw error
        const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
        return NextResponse.json({ success: true, path: data.path, token: data.token, publicUrl: pub.publicUrl })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const b = await req.json().catch(() => ({}))
        if (!b.path || !b.url) return NextResponse.json({ success: false, error: 'path and url are required' }, { status: 400 })
        const { data, error } = await supabaseAdmin
            .from('pipeline_assets')
            .insert({
                character: b.character || null,
                label: b.label || 'untitled',
                storage_path: b.path,
                url: b.url,
                content_type: b.contentType || null,
                size_bytes: b.sizeBytes || null,
                asset_type: 'reference',
                content_item_id: null,
                picture_slot: null,
            })
            .select('id,character,label,url,content_type,created_at')
            .single()
        if (error) throw error
        return NextResponse.json({ success: true, asset: data })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
