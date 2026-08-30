import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { uploadToStorage, deleteFromGCS } from '@/lib/storage'

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

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const character = (formData.get('character') as string) || null
        const label = (formData.get('label') as string) || file?.name || 'untitled'
        const itemId = (formData.get('item_id') as string) || null
        const pictureSlotRaw = formData.get('picture_slot') as string
        const pictureSlot = pictureSlotRaw ? Number(pictureSlotRaw) : null
        const assetType = (formData.get('asset_type') as string) || 'reference'

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const folder = itemId ? `items/${itemId}` : (character || 'shared')
        const storagePath = `${folder}/${Date.now()}-${cleanName}`

        const publicUrl = await uploadToStorage('pipeline-assets', storagePath, buffer, file.type || 'application/octet-stream')

        // uploading to a slot that already has an image replaces it, so each
        // <Picture N> slot on an item holds exactly one asset
        if (itemId && pictureSlot !== null) {
            const { data: existing } = await supabase
                .from('pipeline_assets')
                .select('id, storage_path')
                .eq('content_item_id', itemId)
                .eq('picture_slot', pictureSlot)
            if (existing?.length) {
                for (const old of existing) {
                    if (old.storage_path) await deleteFromGCS(old.storage_path)
                }
                await supabase.from('pipeline_assets').delete().eq('content_item_id', itemId).eq('picture_slot', pictureSlot)
            }
        }

        const { data, error } = await supabase.from('pipeline_assets').insert([{
            character,
            label,
            content_item_id: itemId,
            picture_slot: pictureSlot,
            asset_type: assetType,
            storage_path: `pipeline-assets/${storagePath}`,
            url: publicUrl,
            content_type: file.type || null,
            size_bytes: buffer.length,
        }]).select()

        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
