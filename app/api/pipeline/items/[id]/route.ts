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

        // note/status/scheduling/follow-up metrics are human-editable from the
        // dashboard; everything else is written by the pipeline at creation time
        const {
            note, title, status, scheduled_date, posted_at,
            views, retention_pct, likes, comments_count, shares,
            rating, follow_up_notes,
        } = body
        const updateData: any = {}
        if (note !== undefined) updateData.note = note
        if (title !== undefined) updateData.title = title
        if (status !== undefined) updateData.status = status
        if (scheduled_date !== undefined) updateData.scheduled_date = scheduled_date
        if (posted_at !== undefined) updateData.posted_at = posted_at
        if (views !== undefined) updateData.views = views
        if (retention_pct !== undefined) updateData.retention_pct = retention_pct
        if (likes !== undefined) updateData.likes = likes
        if (comments_count !== undefined) updateData.comments_count = comments_count
        if (shares !== undefined) updateData.shares = shares
        if (rating !== undefined) updateData.rating = rating
        if (follow_up_notes !== undefined) updateData.follow_up_notes = follow_up_notes

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
