import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'pipeline-assets'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const character = searchParams.get('character')
        const itemId = searchParams.get('item_id')
        const generalOnly = searchParams.get('general') === 'true'
        const assetType = searchParams.get('asset_type')

        let query = supabase.from('pipeline_assets').select('*').order('created_at', { ascending: false })
        if (character) query = query.eq('character', character)
        if (itemId) query = query.eq('content_item_id', itemId)
        if (generalOnly) query = query.is('content_item_id', null)
        if (assetType) query = query.eq('asset_type', assetType)

        const { data, error } = await query
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

// The file is uploaded straight to Supabase Storage from the browser via a
// signed URL from /api/pipeline/assets/signed-url (bypasses this server's
// request-body size limit entirely). This route only ever receives a small
// JSON body — the storage path/URL of a file that's already there — and
// records it.
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { path, url, character, label, itemId, pictureSlot, assetType, contentType, sizeBytes } = body

        if (!path || !url) {
            return NextResponse.json({ success: false, error: 'path and url are required' }, { status: 400 })
        }

        // uploading to a slot that already has an image replaces it, so each
        // <Picture N> slot on an item holds exactly one asset
        if (itemId && pictureSlot != null) {
            const { data: existing } = await supabase
                .from('pipeline_assets')
                .select('id, storage_path')
                .eq('content_item_id', itemId)
                .eq('picture_slot', pictureSlot)
            if (existing?.length) {
                const oldPaths = existing.map(a => a.storage_path).filter(Boolean)
                if (oldPaths.length) await supabaseAdmin.storage.from(BUCKET).remove(oldPaths)
                await supabase.from('pipeline_assets').delete().eq('content_item_id', itemId).eq('picture_slot', pictureSlot)
            }
        }

        const { data, error } = await supabase.from('pipeline_assets').insert([{
            character: character || null,
            label: label || 'untitled',
            content_item_id: itemId || null,
            picture_slot: pictureSlot ?? null,
            asset_type: assetType || 'reference',
            storage_path: path,
            url,
            content_type: contentType || null,
            size_bytes: sizeBytes ?? null,
        }]).select()

        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
