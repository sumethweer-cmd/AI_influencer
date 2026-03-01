import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('content_items')
            .select(`
                *,
                storyline,
                weekly_plans(campaign_theme),
                generated_images:generated_images!generated_images_content_item_id_fkey(*)
            `)
            .order('sequence_number', { ascending: true })

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
