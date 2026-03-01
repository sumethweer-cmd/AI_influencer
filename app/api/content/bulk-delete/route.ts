import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { ids } = await request.json()

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, error: 'No IDs provided' }, { status: 400 })
        }

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
