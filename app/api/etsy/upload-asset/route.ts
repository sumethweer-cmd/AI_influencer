import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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

        const { data, error } = await supabase.storage
            .from('etsy-assets')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true
            })

        if (error) throw error

        const { data: { publicUrl } } = supabase.storage.from('etsy-assets').getPublicUrl(fileName)

        return NextResponse.json({ success: true, url: publicUrl, path: fileName })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
