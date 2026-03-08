import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteFromGCS } from '@/lib/storage'

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params

        // Optional: Get file path first to delete from storage as well
        const { data: img } = await supabaseAdmin
            .from('generated_images')
            .select('file_path')
            .eq('id', id)
            .single()

        // 1. Delete from Database
        const { error: dbError } = await supabaseAdmin
            .from('generated_images')
            .delete()
            .eq('id', id)

        if (dbError) throw dbError

        // 2. Delete from Storage
        if (img?.file_path) {
            if (img.file_path.includes('storage.googleapis.com')) {
                // Delete from GCS (handles both original and .webp)
                await deleteFromGCS(img.file_path);
            } else if (img.file_path.includes('/storage/v1/object/public/content/')) {
                // Legacy Supabase Deletion
                const pathParts = img.file_path.split('/storage/v1/object/public/content/')
                if (pathParts.length > 1) {
                    const storagePath = decodeURIComponent(pathParts[1])
                    await supabaseAdmin.storage
                        .from('content')
                        .remove([storagePath])
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('Delete error:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
