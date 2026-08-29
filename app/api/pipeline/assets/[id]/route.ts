import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { deleteFromGCS } from '@/lib/storage'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const id = (await params).id

        const { data: asset, error: fetchError } = await supabase
            .from('pipeline_assets').select('storage_path').eq('id', id).single()
        if (fetchError) throw fetchError

        if (asset?.storage_path) {
            await deleteFromGCS(asset.storage_path)
        }

        const { error } = await supabase.from('pipeline_assets').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
