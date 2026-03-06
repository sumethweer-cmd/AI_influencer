import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { ids } = await request.json()

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, error: 'No IDs provided' }, { status: 400 })
        }

        // 1. Fetch the content items to get their generated images
        const { data: items } = await supabaseAdmin
            .from('content_items')
            .select(`
                id,
                generated_images (
                    file_path
                )
            `)
            .in('id', ids)

        // 2. Extract filenames and delete from Storage
        if (items && items.length > 0) {
            const filesToRemove: string[] = []
            
            items.forEach((item: any) => {
                if (item.generated_images && item.generated_images.length > 0) {
                    item.generated_images.forEach((img: any) => {
                        const url = img.file_path
                        if (!url) return
                        const match = url.match(/\/public\/content\/(.+)$/)
                        if (match && match[1]) {
                            filesToRemove.push(match[1])
                        } else {
                            const parts = url.split('/')
                            filesToRemove.push(parts[parts.length - 1])
                        }
                    })
                }
            })

            // Group into chunks of 100 max per supabase storage batch limit (optional but good practice)
            if (filesToRemove.length > 0) {
                const chunkSize = 100
                for (let i = 0; i < filesToRemove.length; i += chunkSize) {
                    const chunk = filesToRemove.slice(i, i + chunkSize)
                    const { error: storageErr } = await supabaseAdmin.storage.from('content').remove(chunk)
                    if (storageErr) {
                        console.error('Error deleting bulk files from storage:', storageErr)
                    }
                }
            }
        }

        // 3. Delete from DB
        const { error } = await supabaseAdmin
            .from('content_items')
            .delete()
            .in('id', ids)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
