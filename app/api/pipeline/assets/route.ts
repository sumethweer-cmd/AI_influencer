import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { uploadToStorage } from '@/lib/storage'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const character = searchParams.get('character')

        let query = supabase.from('pipeline_assets').select('*').order('created_at', { ascending: false })
        if (character) query = query.eq('character', character)

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

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const folder = character || 'shared'
        const storagePath = `${folder}/${Date.now()}-${cleanName}`

        const publicUrl = await uploadToStorage('pipeline-assets', storagePath, buffer, file.type || 'application/octet-stream')

        const { data, error } = await supabase.from('pipeline_assets').insert([{
            character,
            label,
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
