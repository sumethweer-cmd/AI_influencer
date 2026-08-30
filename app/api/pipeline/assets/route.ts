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

async function insertAssetRecord(fields: {
    character: string | null
    label: string
    itemId: string | null
    pictureSlot: number | null
    assetType: string
    storagePath: string
    url: string
    contentType: string | null
    sizeBytes: number | null
}) {
    const { character, label, itemId, pictureSlot, assetType, storagePath, url, contentType, sizeBytes } = fields

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
        storage_path: storagePath,
        url,
        content_type: contentType,
        size_bytes: sizeBytes,
    }]).select()

    if (error) throw error
    return data[0]
}

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get('content-type') || ''

        // JSON body = "finalize" call: the file was already PUT directly to
        // GCS via a signed URL from /api/pipeline/assets/signed-url (used
        // for anything that could exceed the serverless request-body limit,
        // e.g. video clips). We only record its metadata here.
        if (contentType.includes('application/json')) {
            const body = await req.json()
            const { storagePath, url, character, label, itemId, pictureSlot, assetType, contentType: fileContentType, sizeBytes } = body

            if (!storagePath || !url) {
                return NextResponse.json({ success: false, error: 'storagePath and url are required' }, { status: 400 })
            }

            const asset = await insertAssetRecord({
                character: character || null,
                label: label || 'untitled',
                itemId: itemId || null,
                pictureSlot: pictureSlot ?? null,
                assetType: assetType || 'reference',
                storagePath,
                url,
                contentType: fileContentType || null,
                sizeBytes: sizeBytes ?? null,
            })
            return NextResponse.json({ success: true, data: asset })
        }

        // multipart form-data = direct small-file upload (existing flow,
        // kept for simplicity — fine for typical reference images)
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

        const asset = await insertAssetRecord({
            character,
            label,
            itemId,
            pictureSlot,
            assetType,
            storagePath: `pipeline-assets/${storagePath}`,
            url: publicUrl,
            contentType: file.type || null,
            sizeBytes: buffer.length,
        })

        return NextResponse.json({ success: true, data: asset })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
