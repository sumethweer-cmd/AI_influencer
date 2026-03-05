import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { ids, updates } = body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Ids must be a non-empty array' }, { status: 400 })
        }

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json({ success: false, error: 'Updates must be a valid object' }, { status: 400 })
        }

        let { error } = await supabaseAdmin
            .from('content_items')
            .update(updates)
            .in('id', ids)

        if (error) {
            console.error('Supabase bulk update error:', error)
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error('Bulk update error:', e)
        return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
    }
}
