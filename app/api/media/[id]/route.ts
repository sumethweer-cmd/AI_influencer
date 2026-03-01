import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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

        // 2. Delete from Storage if it's a manual/cropped upload
        if (img?.file_path?.includes('/manual/')) {
            const storagePath = img.file_path.replace('/storage/media/', '')
            await supabaseAdmin.storage
                .from('media')
                .remove([storagePath])
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('Delete error:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
