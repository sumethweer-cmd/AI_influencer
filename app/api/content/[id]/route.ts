import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params
        const updates = await request.json()

        const { error } = await supabaseAdmin
            .from('content_items')
            .update(updates)
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
