#!/usr/bin/env node
// Uploads one outfit reference image to Supabase Storage (bucket
// 'pipeline-assets') and inserts a matching row into pipeline_assets
// (asset_type: 'reference'), linked to a pipeline_content_items row.
//
// Usage: node scripts/upload-outfit-reference.mjs <content_item_id> <image_path> <label> <character> [picture_slot]
// picture_slot (1|2|3) matters — the dashboard's Reference Images grid groups
// by this number, not by the label text. Defaults to 2 (outfit) since that's
// this script's primary use case; pass 1 (character) or 3 (setting) explicitly
// for other reference types.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
    const [contentItemId, imagePath, label, character, pictureSlotArg] = process.argv.slice(2)
    const pictureSlot = pictureSlotArg ? Number(pictureSlotArg) : 2
    if (!contentItemId || !imagePath) {
        console.error('Usage: node scripts/upload-outfit-reference.mjs <content_item_id> <image_path> <label> <character>')
        process.exit(1)
    }

    const fileBuffer = readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase() || '.jpg'
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'
    const fileName = `${Date.now()}-${path.basename(imagePath)}`
    const storagePath = `items/${contentItemId}/${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('pipeline-assets')
        .upload(storagePath, fileBuffer, { contentType, upsert: false })

    if (uploadError) {
        console.error('Upload failed:', uploadError.message)
        process.exit(1)
    }

    const { data: publicUrlData } = supabase.storage.from('pipeline-assets').getPublicUrl(storagePath)
    const url = publicUrlData.publicUrl

    const { data, error } = await supabase.from('pipeline_assets').insert([{
        character: character || null,
        label: label || 'Picture 2',
        storage_path: storagePath,
        url,
        content_type: contentType,
        size_bytes: fileBuffer.length,
        content_item_id: contentItemId,
        asset_type: 'reference',
        picture_slot: pictureSlot,
    }]).select()

    if (error) {
        console.error('Insert failed:', error.message)
        process.exit(1)
    }

    console.log(`Uploaded and inserted pipeline_assets row: ${data[0].id} -> ${url}`)
}

main()
