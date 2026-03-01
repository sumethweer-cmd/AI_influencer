import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        const contentItemId = formData.get('contentItemId') as string
        const imageType = (formData.get('imageType') as string) || 'SFW'

        if (!file || !contentItemId) {
            return NextResponse.json({ success: false, error: 'Missing file or contentItemId' }, { status: 400 })
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png'
        const isVideo = ['mp4', 'mov', 'avi', 'webm'].includes(fileExt)
        const mediaType = isVideo ? 'video' : 'image'
        const fileName = `${crypto.randomUUID()}.${fileExt}`

        // 1. Save to local storage
        const buffer = Buffer.from(await file.arrayBuffer())
        const relativeDir = path.join(contentItemId, 'manual')
        const absoluteDir = path.join(process.cwd(), 'storage', isVideo ? 'videos' : 'images', relativeDir)

        if (!fs.existsSync(absoluteDir)) {
            fs.mkdirSync(absoluteDir, { recursive: true })
        }

        const absolutePath = path.join(absoluteDir, fileName)
        fs.writeFileSync(absolutePath, buffer)

        const dbFilePath = `/storage/${isVideo ? 'videos' : 'images'}/${contentItemId}/manual/${fileName}`

        // 2. Record in generated_images as a MANUAL type
        const { data, error: dbError } = await supabaseAdmin
            .from('generated_images')
            .insert({
                content_item_id: contentItemId,
                image_type: imageType,
                file_path: dbFilePath,
                file_name: file.name,
                status: 'Generated',
                media_type: mediaType,
                gen_attempt: 0,
                seed: 0
            })
            .select()
            .single()

        if (dbError) throw dbError

        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        console.error('Upload error:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
