import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 })

        const { error } = await supabaseAdmin
            .from('comfyui_workflows')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 })

        const body = await request.json()
        const { base_positive_prompt, base_negative_prompt, negative_prompt_node_id } = body

        const { data, error } = await supabaseAdmin
            .from('comfyui_workflows')
            .update({
                base_positive_prompt,
                base_negative_prompt,
                negative_prompt_node_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
