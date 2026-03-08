import { NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage'

export async function POST(req: Request) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        const folder = formData.get('folder') as string || 'fonts'

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
        }

        const buffer = await file.arrayBuffer()
        // clean up filename to avoid weird urls
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `${folder}/${Date.now()}-${cleanName}`

        const publicUrl = await uploadToStorage('etsy-assets', fileName, Buffer.from(buffer), file.type)

        return NextResponse.json({ success: true, url: publicUrl, path: fileName })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
