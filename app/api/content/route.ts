import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('content_items')
            .select('*, generated_images(*)')
            .order('sequence_number', { ascending: true })

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
