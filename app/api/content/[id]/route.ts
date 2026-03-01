import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const updates = await request.json()

        const { generated_images, ...contentUpdates } = updates

        // 1. Update Content Item
        const { error: contentErr } = await supabaseAdmin
            .from('content_items')
            .update(contentUpdates)
            .eq('id', id)

        if (contentErr) throw contentErr

        // 2. Update Generated Images if provided
        if (generated_images && Array.isArray(generated_images)) {
            for (const img of generated_images) {
                await supabaseAdmin.from('generated_images').update({
                    vdo_prompt: img.vdo_prompt,
                    vdo_status: img.vdo_status,
                    vdo_job_id: img.vdo_job_id
                }).eq('id', img.id)
            }
        }
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params

        // Supabase usually has ON DELETE CASCADE, but let's be explicit if needed
        // For this project, we assume cascade is handled by DB schema
        const { error } = await supabaseAdmin
            .from('content_items')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
