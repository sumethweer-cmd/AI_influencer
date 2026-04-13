import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteFromGCS } from '@/lib/storage'

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

        // 2. Delete the entire GCS folder for this content item
        // This ensures manually synced files are also removed, preventing orphans
        await deleteGCSFolder(`images/${id}`);

        // 3. Extract and delete legacy Supabase files
        if (item && item.generated_images && item.generated_images.length > 0) {
            const supabaseFilesToRemove: string[] = []

            for (const img of item.generated_images) {
                const url = img.file_path
                if (!url) continue

                if (url.includes('/public/content/')) {
                    // Collect Supabase files for bulk deletion
                    const match = url.match(/\/public\/content\/(.+)$/)
                    if (match && match[1]) {
                        supabaseFilesToRemove.push(match[1])
                    } else {
                        const parts = url.split('/')
                        supabaseFilesToRemove.push(parts[parts.length - 1])
                    }
                }
            }

            if (supabaseFilesToRemove.length > 0) {
                const { error: storageErr } = await supabaseAdmin.storage.from('content').remove(supabaseFilesToRemove)
                if (storageErr) {
                    console.error('Error deleting files from Supabase storage:', storageErr)
                }
            }
        }

        // 4. Delete the database record (cascade should handle related tables)
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
