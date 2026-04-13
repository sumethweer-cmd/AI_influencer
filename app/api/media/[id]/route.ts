import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { deleteFromGCS } from '@/lib/storage'

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        const { searchParams } = new URL(request.url)
        let filePath = searchParams.get('filePath')

        // If it's a DB record (doesn't start with gcs-), fetch its path and delete it from DB
        if (!id.startsWith('gcs-')) {
            const { data: img } = await supabaseAdmin
                .from('generated_images')
                .select('file_path')
                .eq('id', id)
                .single()

            if (img?.file_path) {
                filePath = img.file_path
            }

            // 1. Delete from Database
            const { error: dbError } = await supabaseAdmin
                .from('generated_images')
                .delete()
                .eq('id', id)

            if (dbError) {
                console.error('Delete DB error:', dbError)
                // Continue to storage deletion even if DB fails, to prevent orphans, though typically we throw
            }
        }

        // 2. Delete from Storage
        if (filePath) {
            if (filePath.includes('storage.googleapis.com') || filePath.startsWith('images/')) {
                // Delete from GCS (handles both original and .webp)
                await deleteFromGCS(filePath);
            } else if (filePath.includes('/storage/v1/object/public/content/')) {
                // Legacy Supabase Deletion
                const pathParts = filePath.split('/storage/v1/object/public/content/')
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
