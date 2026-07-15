import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const { data, error } = await supabase.from('etsy_books').select('*, etsy_pages(*)').eq('id', id).single()
        if (error) throw error

        // sort pages
        if (data.etsy_pages) data.etsy_pages.sort((a: any, b: any) => a.page_number - b.page_number)

        // resolve character_ids -> full character records for the editor UI
        if (data.character_ids?.length) {
            const { data: chars } = await supabase.from('etsy_characters').select('*').in('id', data.character_ids)
            data.characters = chars || []
        } else {
            data.characters = []
        }

        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const body = await req.json()
        
        // update allowed fields
        const { title, theme, status, price, total_sales, posted_at, cover_image_url, pdf_config, character_ids, learning_goal, occasion, etsy_description } = body

        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (theme !== undefined) updateData.theme = theme
        if (status !== undefined) updateData.status = status
        if (price !== undefined) updateData.price = price
        if (total_sales !== undefined) updateData.total_sales = total_sales
        if (posted_at !== undefined) updateData.posted_at = posted_at
        if (cover_image_url !== undefined) updateData.cover_image_url = cover_image_url
        if (pdf_config !== undefined) updateData.pdf_config = pdf_config
        if (character_ids !== undefined) updateData.character_ids = character_ids
        if (learning_goal !== undefined) updateData.learning_goal = learning_goal
        if (occasion !== undefined) updateData.occasion = occasion
        if (etsy_description !== undefined) updateData.etsy_description = etsy_description

        const { data, error } = await supabase.from('etsy_books').update(updateData).eq('id', id).select()
        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const { error } = await supabase.from('etsy_books').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
