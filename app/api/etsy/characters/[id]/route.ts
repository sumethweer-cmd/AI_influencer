import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const body = await req.json()
        const { name, species, appearance, personality, reference_image_url } = body

        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (species !== undefined) updateData.species = species
        if (appearance !== undefined) updateData.appearance = appearance
        if (personality !== undefined) updateData.personality = personality
        if (reference_image_url !== undefined) updateData.reference_image_url = reference_image_url

        const { data, error } = await supabase.from('etsy_characters').update(updateData).eq('id', id).select()
        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const { error } = await supabase.from('etsy_characters').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
