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

        // 1. Fetch the content item to get its generated images
        const { data: item } = await supabaseAdmin
            .from('content_items')
            .select(`
                id,
                generated_images (
                    file_path
                )
            `)
            .eq('id', id)
            .single()

        // 2. Extract filenames and delete from Storage
        if (item && item.generated_images && item.generated_images.length > 0) {
            const filesToRemove = item.generated_images
                .map((img: any) => {
                    const url = img.file_path
                    if (!url) return null
                    // Extract path after bucket name
                    const match = url.match(/\/public\/content\/(.+)$/)
                    if (match && match[1]) {
                        return match[1]
                    }
                    const parts = url.split('/')
                    return parts[parts.length - 1]
                })
                .filter(Boolean)

            if (filesToRemove.length > 0) {
                const { error: storageErr } = await supabaseAdmin.storage.from('content').remove(filesToRemove)
                if (storageErr) {
                    console.error('Error deleting files from storage:', storageErr)
                }
            }
        }

        // 3. Delete the database record (cascade should handle related tables)
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
