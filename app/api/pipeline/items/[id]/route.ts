import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const { data, error } = await supabase.from('pipeline_content_items').select('*').eq('id', id).single()
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const body = await req.json()

        // only note/status are meant to be human-editable from the dashboard;
        // everything else is written by the pipeline at creation time
        const { note, status } = body
        const updateData: any = {}
        if (note !== undefined) updateData.note = note
        if (status !== undefined) updateData.status = status

        const { data, error } = await supabase.from('pipeline_content_items').update(updateData).eq('id', id).select()
        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id
        const { error } = await supabase.from('pipeline_content_items').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
