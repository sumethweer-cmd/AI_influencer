import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id
        const body = await req.json()
        
        const { story_text, image_prompt, image_url, status } = body
        const updateData: any = {}
        if (story_text !== undefined) updateData.story_text = story_text
        if (image_prompt !== undefined) updateData.image_prompt = image_prompt
        if (image_url !== undefined) updateData.image_url = image_url
        if (status !== undefined) updateData.status = status

        const { data, error } = await supabase.from('etsy_pages').update(updateData).eq('id', id).select()
        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id
        const { error } = await supabase.from('etsy_pages').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
