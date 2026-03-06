import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('comfyui_workflows')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const {
            name, persona, workflow_type, prompt_node_id, width_node_id, height_node_id,
            batch_size_node_id, video_image_node_id, video_prompt_node_id, output_node_id,
            video_prompt_2_node_id, video_prompt_3_node_id,
            workflow_json, base_positive_prompt, base_negative_prompt, negative_prompt_node_id
        } = body

        if (!name || !workflow_json || !prompt_node_id) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('comfyui_workflows')
            .insert({
                name,
                persona: persona || null,
                workflow_type: workflow_type || 'SFW',
                prompt_node_id,
                negative_prompt_node_id,
                width_node_id,
                height_node_id,
                batch_size_node_id,
                video_image_node_id,
                video_prompt_node_id,
                video_prompt_2_node_id,
                video_prompt_3_node_id,
                output_node_id,
                workflow_json,
                base_positive_prompt,
                base_negative_prompt
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
