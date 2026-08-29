import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const character = searchParams.get('character')
        const status = searchParams.get('status')
        const scheduledFrom = searchParams.get('scheduled_from')
        const scheduledTo = searchParams.get('scheduled_to')

        let query = supabase.from('pipeline_content_items').select('*').order('created_at', { ascending: false })
        if (character) query = query.eq('character', character)
        if (status) query = query.eq('status', status)
        if (scheduledFrom) query = query.gte('scheduled_date', scheduledFrom)
        if (scheduledTo) query = query.lte('scheduled_date', scheduledTo)

        const { data, error } = await query
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            character, content_category, core_mechanic, delivery_format,
            visual_format, platform, model, character_take, compiled_prompt,
            srt_content, validation_report, status,
        } = body

        if (!character || !compiled_prompt) {
            return NextResponse.json({ success: false, error: 'character and compiled_prompt are required' }, { status: 400 })
        }

        const { data, error } = await supabase.from('pipeline_content_items').insert([{
            character, content_category, core_mechanic, delivery_format,
            visual_format, platform, model, character_take, compiled_prompt,
            srt_content, validation_report, status: status || 'pending',
        }]).select()

        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
