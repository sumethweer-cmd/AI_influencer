import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabase.from('etsy_workflows').select('*').order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, workflow_json, base_positive_prompt, base_negative_prompt, negative_prompt_node_id } = body
        
        const { data, error } = await supabase.from('etsy_workflows').insert([{
            name, workflow_json, base_positive_prompt, base_negative_prompt, negative_prompt_node_id
        }]).select()
        
        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
